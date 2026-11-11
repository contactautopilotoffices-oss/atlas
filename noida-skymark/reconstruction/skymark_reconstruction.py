"""F1 Skymark (Sector 6, Noida): procedural facade reconstruction in Blender.

A reusable bpy module. Every dimension comes from facade_parameters.json,
which records where each number came from and how confident it is. Nothing
here is a hard-coded measurement except the safe defaults used when a key is
missing.

Run headless (bpy 5.2.3, the same version as scripts/world/):

    python3 -m venv .bvenv && .bvenv/bin/pip install bpy==5.2.3
    .bvenv/bin/python noida-skymark/reconstruction/skymark_reconstruction.py \
        --params noida-skymark/reconstruction/facade_parameters.json \
        --out noida-skymark [--blend path/to/existing.blend] [--samples 48]

Pipeline (each step can also be called on its own from Blender's Python
console after `import skymark_reconstruction as sk`):

  1. open the existing .blend if given (else start from an empty scene),
     save a backup, audit it            -> reconstruction/*.json, scene_preview.png
  2. build the facade in a dedicated "SKY_Reconstruction" collection; the
     existing geometry is never edited
  3. render the reference, front, side and three-quarter views -> renders/
  4. save exports/fm_skymark_final.blend, export exports/fm_skymark_atlas.glb
  5. reopen the GLB in a clean scene, check names, materials, UVs and size,
     and write reconstruction/validation_report.json

Required generators (all take the params dict and return created objects):
  generate_curtain_wall, generate_glass_panels, generate_mullions,
  generate_cladding_panels, generate_floor_bands,
  generate_angular_facade_frame, generate_signage_zones, generate_entrance,
  apply_facade_materials

Facade detail is real geometry (mullions, transoms, spandrels, frame members,
cladding joints), not texture. Each component is one mesh object so it can be
moved, hidden or regenerated on its own, and carries custom properties:
sky_component, sky_confidence, sky_source, sky_observed.
"""
import argparse
import json
import math
import os
import shutil
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

COLL_NAME = "SKY_Reconstruction"
ROOT_NAME = "SKY_F1_Skymark"
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


def apply_facade_materials(P):
    """PBR materials (Principled BSDF, exported as glTF metallic-roughness).
    Values come from P['materials']; signage colours from P['signage']."""
    spec = dict(P.get("materials", {}))
    defaults = {
        "glass_bluegrey": {"base": "#6f8798", "metallic": 0.55, "roughness": 0.07},
        "glass_dark": {"base": "#1d2730", "metallic": 0.45, "roughness": 0.09},
        "cladding_white": {"base": "#d9dcdd", "metallic": 0.15, "roughness": 0.42},
        "aluminium": {"base": "#b9bec4", "metallic": 1.0, "roughness": 0.32},
        "concrete": {"base": "#8b8781", "metallic": 0.0, "roughness": 0.9},
        "paving": {"base": "#77726b", "metallic": 0.0, "roughness": 0.95},
        "accent_brown": {"base": "#4a2a1a", "metallic": 0.1, "roughness": 0.55},
    }
    for k, v in defaults.items():
        spec.setdefault(k, v)
    names = {"glass_bluegrey": "SKY_Glass_BlueGrey_Reflective", "glass_dark": "SKY_Glass_DarkTint",
             "cladding_white": "SKY_Cladding_WhiteLightGrey", "aluminium": "SKY_Aluminium_Frame",
             "concrete": "SKY_Concrete", "paving": "SKY_Ground_Paving", "accent_brown": "SKY_Accent_BrownPanel"}
    for key, s in spec.items():
        MATS[key] = _material(names.get(key, "SKY_" + key), s["base"], s["metallic"], s["roughness"])
    for sg in P.get("signage", []):
        for side in ("bg_left", "bg_right", "text_color", "mark_color"):
            c = sg.get(side)
            if c and ("sign_" + c) not in MATS:
                MATS["sign_" + c] = _material("SKY_Sign_" + c.lstrip("#").upper(), c, 0.0, 0.35,
                                              emit=0.25 if side != "text_color" else 0.0)
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


# ============================================================== massing ===
def generate_core_massing(P, F):
    """Floor slabs, roof and the closed back of the building. The rear and far
    side are not in the photograph: they are plain cladding, observed=false."""
    c = sub_collection("Massing")
    m = P["massing"]
    th = P.get("roof", {}).get("slab_th", 0.3)
    inset = 0.9  # slabs stop short of the facade so the glass reads in front
    mb = MeshBuilder("SKY_Floor_Slabs")
    # ground slab and the four floor slabs; the roof slab is part of
    # SKY_Hidden_Rear_Massing, so it is not drawn twice
    for i in range(m["floors_above_ground"]):
        z = i * m["floor_to_floor"]
        mb.box((inset, inset, z - th), (F.W - 0.5, F.L - 0.5, z), "concrete")
    obs = [mb.to_object(c, tag("floor_slabs", conf_of(m, "floor_to_floor"), m["source"]["floor_to_floor"]))]
    # interior volume (dark, so the glass reads as a deep building at night/day)
    core = MeshBuilder("SKY_Interior_Core")
    core.box((inset + 1.2, inset + 1.2, 0), (F.W - 2.2, F.L - 2.2, F.roof), "glass_dark")
    obs.append(core.to_object(c, tag("interior_core", "low", "Neutral dark volume behind the glazing; interior not surveyed", False)))
    # hidden rear (y = L) and far side (x = W) as plain cladding, roof slab, parapet return
    rear = MeshBuilder("SKY_Hidden_Rear_Massing")
    rear.box((0.3, F.L - 0.4, 0), (F.W, F.L, F.H), "cladding_white")
    rear.box((F.W - 0.4, 0.3, 0), (F.W, F.L, F.H), "cladding_white")
    rear.box((0.3, 0.3, F.roof - th), (F.W - 0.1, F.L - 0.1, F.roof), "concrete")
    obs.append(rear.to_object(c, tag("hidden_massing", "low", m["hidden_sides"], False)))
    roofp = MeshBuilder("SKY_Roof_Parapet_Returns")
    roofp.box((0.0, 0.0, F.roof), (0.35, F.L, F.H), "cladding_white")       # behind B parapet
    roofp.box((0.0, 0.0, F.roof), (F.W, 0.35, F.H), "cladding_white")       # behind A parapet
    obs.append(roofp.to_object(c, tag("parapet_returns", "medium", "photo: parapet line continuous along A and B")))
    return obs


# ========================================================= curtain walls ===
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
                 lo=None, hi=None, mull_mat="aluminium", mull_w=0.07,
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
        ms=1.5, ts=2.25, spandrel=True, recess=fr.get("infill_recess", 0.3), hi=lambda v: diag(v) - w / 2)
    sg = B["slanted_glazing"]
    add("SideB_SlantedGlazing", "B", sg, "glass_bluegrey", u0=fr["top_right_u"], spandrel=True, tilt=sg.get("tilt_out_at_bottom", 0.0),
        lo=lambda v: diag(v) + w / 2)
    add("SideB_GroundBase", "B", B["ground_base"], "glass_dark", ms=B["ground_base"]["pilaster_spacing"] / 2)
    ac = conf_of(an, "height")
    ff, gf = an["first_floor_glazing"], an["ground_glazing"]
    add("Annex_FirstFloor", "annex", ff, "glass_bluegrey", u0=an["u0"] + 0.4, u1=an["u1"] - 0.4, conf=ac, src=an["source"])
    add("Annex_Ground", "annex", gf, "glass_dark", u0=an["u0"] + 0.4, u1=an["u1"] - 0.4, conf=ac, src=an["source"])
    return R


def _pt(F, P, facade, u, v, out=0.0):
    if facade == "A":
        return F.A(u, v, out)
    if facade == "B":
        return F.B(u, v, out)
    return F.annex_front(P, u, v, out)


def _normal(facade):
    return Vector((0, -1, 0)) if facade in ("A", "annex") else Vector((-1, 0, 0))


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
    """The curtain wall carrier for each glazed region: head and sill plates
    that close the opening. Glass, mullions and floor bands are separate
    components (generate_glass_panels, generate_mullions,
    generate_floor_bands) so each can be changed on its own."""
    c = sub_collection("CurtainWall")
    obs = []
    for r in _curtain_regions(P, F):
        mb = MeshBuilder(f"SKY_{r['name']}_HeadSill")
        n = _normal(r["fac"])
        for v in (r["v0"], r["v1"]):
            u0, u1 = _span(r, v)
            o = _out(r, v)
            mb.slab_between(_pt(F, P, r["fac"], u0, v, o), _pt(F, P, r["fac"], u1, v, o), 0.12, 0.22, n, "aluminium")
        obs.append(mb.to_object(c, tag("curtain_wall_head_sill", r["conf"], r["src"])))
    return obs


def generate_glass_panels(P, F):
    """Glass as real panes, one quad per bay and row, so reflections break
    at every mullion the way they do in the photograph."""
    c = sub_collection("Glass")
    obs = []
    for r in _curtain_regions(P, F):
        mb = MeshBuilder(f"SKY_{r['name']}_Glass")
        for va, vb in _rows(r):
            (a0, a1), (b0, b1) = _span(r, va), _span(r, vb)
            oa, ob_ = _out(r, va) + 0.05, _out(r, vb) + 0.05
            n = _cols(r, va, vb)
            for k in range(n):
                fa0, fa1 = a0 + (a1 - a0) * k / n, a0 + (a1 - a0) * (k + 1) / n
                fb0, fb1 = b0 + (b1 - b0) * k / n, b0 + (b1 - b0) * (k + 1) / n
                mb.quad([_pt(F, P, r["fac"], fa0, va, oa), _pt(F, P, r["fac"], fa1, va, oa),
                         _pt(F, P, r["fac"], fb1, vb, ob_), _pt(F, P, r["fac"], fb0, vb, ob_)], r["glass"])
        obs.append(mb.to_object(c, tag("glass_panels", r["conf"], r["src"])))
    return obs


def generate_mullions(P, F, depth=0.16, transom_w=0.08):
    """Vertical mullions and horizontal transoms as bars on every bay and row
    line. Width and material per region (the top ribbon's are wide white
    piers; the curtain walls' are 7 cm aluminium)."""
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
                mb.slab_between(_pt(F, P, r["fac"], b0, vb, ob_), _pt(F, P, r["fac"], b1, vb, ob_), transom_w, depth + 0.02, nrm, "aluminium")
        obs.append(mb.to_object(c, tag("mullions", r["conf"], r["src"])))
    return obs


def generate_floor_bands(P, F):
    """Spandrel bands at each slab edge on the curtain walls (dark tinted
    glass), the parapet bands on A and B, and the white ledge above the
    angular frame. Each is its own object."""
    c = sub_collection("FloorBands")
    m = P["massing"]
    obs = []
    sp = MeshBuilder("SKY_Spandrel_Bands")
    h = P["front_A"]["glass_block"].get("spandrel_h", 0.55)
    for r in _curtain_regions(P, F):
        if not r["spandrel"]:
            continue
        n = _normal(r["fac"])
        for i in range(1, m["floors_above_ground"] + 1):
            z = i * m["floor_to_floor"] - h / 2
            if z - h / 2 <= r["v0"] + 0.2 or z + h / 2 >= r["v1"] - 0.2:
                continue
            u0, u1 = _span(r, z)
            o = _out(r, z)
            sp.slab_between(_pt(F, P, r["fac"], u0, z, o), _pt(F, P, r["fac"], u1, z, o), h, 0.2, n, "glass_dark")
    obs.append(sp.to_object(c, tag("spandrel_bands", "medium", "photo: darker horizontal band at every slab edge across the curtain wall")))
    pb = MeshBuilder("SKY_Parapet_Bands")
    a = P["front_A"]["parapet_band"]
    pb.box((a["u0"], -a["projection"], a["v0"]), (a["u1"], 0.0, a["v1"]), "cladding_white")
    b = P["side_B"]["parapet_band"]
    pb.box((-b["projection"], F.L - b["u1"], b["v0"]), (0.0, F.L - b["u0"], b["v1"]), "cladding_white")
    obs.append(pb.to_object(c, tag("parapet_bands", a["confidence"], a["source"])))
    tb = MeshBuilder("SKY_SideB_Ledge_AboveFrame")
    t = P["side_B"]["frame_top_band"]
    tb.box((-t["projection"], F.L - t["u1"], t["v0"]), (0.0, F.L - t["u0"], t["v1"]), "cladding_white")
    obs.append(tb.to_object(c, tag("ledge_above_frame", t["confidence"], t["source"])))
    return obs


# =============================================================== cladding ===
def generate_cladding_panels(P, F, joint=0.012):
    """White and light-grey cladding as individual panels with real 12 mm
    joints: the corner pier and right pier on A, the end pier and the panel
    pier on B, the brown accent strip, side B's wall plane and pilasters,
    and the annex body."""
    c = sub_collection("Cladding")
    obs = []

    def panels(mb, fac, blk, mat, pw=None, ph=None):
        u0, u1, v0, v1, proj = blk["u0"], blk["u1"], blk["v0"], blk["v1"], blk.get("projection", 0.3)
        pw, ph = pw or blk.get("panel_w", 1.5), ph or blk.get("panel_h", 1.5)
        nu, nv = max(1, round((u1 - u0) / pw)), max(1, round((v1 - v0) / ph))
        for i in range(nu):
            for j in range(nv):
                ua, ub = u0 + (u1 - u0) * i / nu + joint / 2, u0 + (u1 - u0) * (i + 1) / nu - joint / 2
                va, vb = v0 + (v1 - v0) * j / nv + joint / 2, v0 + (v1 - v0) * (j + 1) / nv - joint / 2
                if fac == "A":
                    mb.box((ua, -proj, va), (ub, -proj + 0.05, vb), mat)
                else:
                    mb.box((-proj, F.L - ub, va), (-proj + 0.05, F.L - ua, vb), mat)
        # the carrier wall behind the panels, so the joints read dark
        if fac == "A":
            mb.box((u0, -proj + 0.05, v0), (u1, 0.0, v1), "concrete")
        else:
            mb.box((-proj + 0.05, F.L - u1, v0), (0.0, F.L - u0, v1), "concrete")

    A, B = P["front_A"], P["side_B"]
    cp = A["corner_pier"]
    mb = MeshBuilder("SKY_FrontA_CornerPier_Cladding")
    panels(mb, "A", cp, "cladding_white")
    obs.append(mb.to_object(c, tag("corner_pier", cp["confidence"], cp["source"])))
    rp = A["right_pier"]
    mb = MeshBuilder("SKY_FrontA_RightPier_Cladding")
    panels(mb, "A", rp, "cladding_white", pw=1.2)
    obs.append(mb.to_object(c, tag("right_pier", rp["confidence"], rp["source"])))
    ep = B["end_pier"]
    mb = MeshBuilder("SKY_SideB_EndPier_Cladding")
    panels(mb, "B", ep, "cladding_white", pw=1.15)
    obs.append(mb.to_object(c, tag("end_pier", ep["confidence"], ep["source"])))
    if "corner_return_pier" in B:
        cr = B["corner_return_pier"]
        mb = MeshBuilder("SKY_SideB_PanelPier_Cladding")
        panels(mb, "B", cr, "cladding_white")
        obs.append(mb.to_object(c, tag("panel_pier", cr["confidence"], cr["source"])))
    ac = B["accent_strip"]
    mb = MeshBuilder("SKY_SideB_AccentStrip_Brown")
    panels(mb, "B", ac, "accent_brown", pw=1.8, ph=3.0)
    # the strip turns the corner onto A's edge
    mb.box((-ac.get("projection", 0.15), -0.05, 0.0), (0.0, 0.0, ac["v1"]), "accent_brown")
    obs.append(mb.to_object(c, tag("accent_strip", ac["confidence"], ac["source"])))
    gb = B["ground_base"]
    mb = MeshBuilder("SKY_SideB_Ground_Pilasters")
    u = gb["u0"] + gb["pilaster_spacing"] / 2
    while u <= gb["u1"] + EPS:
        mb.box((-0.35, F.L - u - gb["pilaster_w"] / 2, 0), (0.0, F.L - u + gb["pilaster_w"] / 2, gb["v1"]), "accent_brown")
        u += gb["pilaster_spacing"]
    obs.append(mb.to_object(c, tag("ground_pilasters", gb["confidence"], gb["source"])))
    mb = MeshBuilder("SKY_SideB_Wall_Plane")
    sbk = B.get("wall_plane_setback", 0.45)   # behind the recessed glazing
    mb.box((sbk, 0.0, 0.0), (sbk + 0.06, F.L, B["parapet_band"]["v1"]), "cladding_white")
    obs.append(mb.to_object(c, tag("side_b_wall_plane", "low", "Wall plane behind side B's features; visible only as narrow strips between them")))
    an = P["annex"]
    mb = MeshBuilder("SKY_Annex_Body")
    d, h = an["depth"], an["height"]
    side = an.get("side_walls", "cladding_white")
    sb = an["sign_band"]
    mb.box((an["u0"], -d, 0.0), (an["u0"] + 0.4, 0.0, sb["v0"]), side)
    mb.box((an["u1"] - 0.4, -d, 0.0), (an["u1"], 0.0, sb["v0"]), side)
    mb.box((an["u0"], -d, sb["v0"]), (an["u1"], 0.0, sb["v1"]), "cladding_white")          # parapet / sign band ring
    mb.box((an["u0"] + 0.3, -d + 0.3, h - 0.9), (an["u1"] - 0.3, -0.3, h - 0.6), "concrete")  # roof slab, set down
    mb.box((an["u0"] + 0.4, -d, an["first_floor_glazing"]["v1"]), (an["u1"] - 0.4, -d + 0.3, sb["v0"]), "cladding_white")
    mb.box((an["u0"] + 0.4, -d, an["ground_glazing"]["v1"]), (an["u1"] - 0.4, -d + 0.3, an["first_floor_glazing"]["v0"]), "cladding_white")
    mb.box((an["u0"] + 0.4, -d, 0.0), (an["u1"] - 0.4, -d + 0.3, an["ground_glazing"]["v0"]), "concrete")
    mb.box((an["u0"] + 0.4, -d + 0.3, 0.0), (an["u1"] - 0.4, -d + 0.5, sb["v0"]), "glass_dark")
    obs.append(mb.to_object(c, tag("annex_body", conf_of(an, "plan_position"), an["source"])))
    lv = an["first_floor_glazing"].get("louvre_spacing")
    if lv:
        mb = MeshBuilder("SKY_Annex_Louvres")
        z = an["first_floor_glazing"]["v0"] + lv
        while z < an["first_floor_glazing"]["v1"] - 0.2:
            mb.box((an["u0"] + 0.4, -d - 0.28, z - 0.06), (an["u1"] - 0.4, -d - 0.18, z + 0.06), "cladding_white")
            z += lv
        obs.append(mb.to_object(c, tag("annex_louvres", "low", "photo: white horizontal lines across the annex's first-floor glazing")))
    return obs


# ========================================================= angular frame ===
def generate_angular_facade_frame(P, F):
    """The white trapezoid frame on side B: a vertical member at the far
    end, top and bottom members, and a leaning member whose foot is nearer
    the corner than its head. All four project from the facade as one box
    frame; the glazing inside is SideB_FrameInfill."""
    c = sub_collection("AngularFrame")
    fr = P["side_B"]["angular_frame"]
    w, proj = fr["member_width"], fr["projection"]
    lu, tru, bru, bv, tv = fr["left_u"], fr["top_right_u"], fr["bottom_right_u"], fr["bottom_v"], fr["top_v"]
    mb = MeshBuilder("SKY_SideB_AngularFrame")

    def bbox(u0, u1, v0, v1):
        mb.box((-proj, F.L - u1, v0), (0.0, F.L - u0, v1), "cladding_white")

    # Members meet edge to edge and never overlap: overlapping coplanar faces
    # render as black patches.
    y = lambda u: F.L - u
    b0, b1, t0, t1 = bru - w / 2, bru + w / 2, tru - w / 2, tru + w / 2
    uL = lambda v: b0 + (t0 - b0) * (v - bv) / (tv - bv)      # leaning member's inner edge

    def member(ua0, ub0, ua1, ub1, va, vb):
        """Box whose ends may be cut on the slant: u from ua0..ub0 at va, ua1..ub1 at vb."""
        mb.hexa([(-proj, y(ub0), va), (0.0, y(ub0), va), (0.0, y(ua0), va), (-proj, y(ua0), va),
                 (-proj, y(ub1), vb), (0.0, y(ub1), vb), (0.0, y(ua1), vb), (-proj, y(ua1), vb)], "cladding_white")

    bbox(lu, lu + w, bv, tv)                                   # vertical member at the far end
    member(lu + w, uL(tv - w), lu + w, uL(tv), tv - w, tv)     # top member, cut to the lean
    member(lu + w, uL(bv), lu + w, uL(bv + w), bv, bv + w)     # bottom member, cut to the lean
    member(b0, b1, t0, t1, bv, tv)                             # leaning member
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


def _sign_mat(col, emit=0.0):
    k = "sign_" + col
    if k not in MATS:
        MATS[k] = _material("SKY_Sign_" + col.lstrip("#").upper(), col, 0.0, 0.4, emit=emit)
    return k


def generate_signage_zones(P, F):
    """Each sign is a backing panel, in one or two colour fields or with a
    colour tile as the photograph shows, with the visible wording as extruded
    lettering in Blender's default font. These mark where the signs are and
    what they say; they are not the brands' artwork."""
    c = sub_collection("Signage")
    obs = []
    for sg in P.get("signage", []):
        host = sg["host"]
        u0, u1, v0, v1 = sg["u0"], sg["u1"], sg["v0"], sg["v1"]
        if host == "front_A":
            yb = -P["front_A"]["corner_pier"]["projection"]
            y0, y1 = yb - 0.16, yb
        elif host == "front_A_roof":
            yb = -P["front_A"]["parapet_band"]["projection"]
            y0, y1 = yb, yb + 0.2
        else:
            yb = -P["annex"]["depth"]
            y0, y1 = yb - 0.2, yb
        split, tile = sg.get("split", 1.0), sg.get("tile")
        fields, texts = [], []
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
            mb.box((fa, y0 - lift, v0 + (0.08 if lift else 0)), (fb, y1, v1 - (0.08 if lift else 0)), _sign_mat(col, emit=0.2))
        obs.append(mb.to_object(c, tag("signage_panel", sg["confidence"], sg["source"])))
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
                mk.slab_between((cx - dx, y0, cz - dz), (cx + dx, y0, cz + dz), s_ * 0.15, 0.05, (0, -1, 0), _sign_mat(sg["mark_color"], emit=0.2))
            obs.append(mk.to_object(c, tag("signage_mark", sg["confidence"], sg["source"])))
    return obs


# ============================================================== entrance ===
def generate_entrance(P, F):
    """Glazed entrance with a slim canopy on the annex front. Its position is
    inferred (the doors are hidden in the photo) and tagged observed=false."""
    c = sub_collection("Entrance")
    e = P["entrance"]
    d = P["annex"]["depth"]
    mb = MeshBuilder("SKY_Entrance")
    u0, u1 = e["u0"], e["u1"]
    # door leaves (two pairs) in dark glass with aluminium frames
    mb.box((u0, -d - 0.12, 0.0), (u1, -d - 0.02, e["door_h"]), "glass_dark")
    for u in (u0, (u0 + u1) / 2, u1):
        mb.box((u - 0.05, -d - 0.16, 0.0), (u + 0.05, -d - 0.02, e["door_h"]), "aluminium")
    mb.box((u0 - 0.05, -d - 0.16, e["door_h"]), (u1 + 0.05, -d - 0.02, e["door_h"] + 0.12), "aluminium")
    # canopy
    mb.box((u0 - 0.6, -d - e["canopy_depth"], e["canopy_v"]), (u1 + 0.6, -d, e["canopy_v"] + e["canopy_th"]), "cladding_white")
    # step / threshold
    mb.box((u0 - 0.6, -d - e["canopy_depth"], 0.0), (u1 + 0.6, -d, 0.15), "concrete")
    ob = mb.to_object(c, tag("entrance", e["confidence"], e["source"], e.get("observed", False)))
    return [ob]


# ================================================================ roof/site =
def generate_roof_and_site(P, F):
    c = sub_collection("Site")
    obs = []
    ms = P.get("roof", {}).get("mast")
    if ms:
        mb = MeshBuilder("SKY_Roof_TelecomMast")
        b, h, x, y, z0 = ms["base"], ms["height"], ms["x"], ms["y"], F.roof
        legs = [(x - b / 2, y - b / 2), (x + b / 2, y - b / 2), (x + b / 2, y + b / 2), (x - b / 2, y + b / 2)]
        for (lx, ly) in legs:
            mb.slab_between((lx, ly, z0), (x + (lx - x) * 0.3, y + (ly - y) * 0.3, z0 + h), 0.08, 0.08, (1, 0, 0), "aluminium")
        for k in range(1, 6):
            zz = z0 + h * k / 6
            s = b / 2 * (1 - 0.7 * k / 6)
            mb.box((x - s, y - s, zz), (x + s, y + s, zz + 0.05), "aluminium")
        mb.slab_between((x, y, z0 + h), (x, y, z0 + h + 2.0), 0.06, 0.06, (1, 0, 0), "aluminium")
        obs.append(mb.to_object(c, tag("roof_mast", ms["confidence"], ms["source"])))
    s = P["site"]
    mg = s["paving_margin"]
    mb = MeshBuilder("SKY_Site_Paving")
    mb.box((-mg, -P["annex"]["depth"] - mg, -0.3), (F.W + mg, F.L + mg, 0.0), "paving")
    obs.append(mb.to_object(c, tag("site_paving", s["confidence"], s["source"])))
    mb = MeshBuilder("SKY_Site_BoundaryWall")
    h = s["boundary_wall_h"]
    x0, y0, x1, y1 = -mg, -P["annex"]["depth"] - mg, F.W + mg, F.L + mg
    gate0, gate1 = P["annex"]["u0"] - 1.0, P["annex"]["u1"] + 1.0
    mb.box((x0, y0, 0), (gate0, y0 + 0.25, h), "concrete")
    mb.box((gate1, y0, 0), (x1, y0 + 0.25, h), "concrete")
    mb.box((x0, y0, 0), (x0 + 0.25, y1, h), "concrete")
    obs.append(mb.to_object(c, tag("boundary_wall", "low", "photo: low wall along the road on the side B frontage; the gate is inferred at the annex")))
    return obs


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


def audit_scene(out_dir, source_blend, preview_path):
    sc = bpy.context.scene
    objs = list(bpy.data.objects)

    def coll_tree(c):
        return {"name": c.name, "objects": [o.name for o in c.objects], "children": [coll_tree(ch) for ch in c.children]}

    inv = []
    for o in objs:
        mn, mx = _world_bbox(o)
        inv.append({"name": o.name, "type": o.type,
                    "collections": [c.name for c in o.users_collection],
                    "location": list(o.location), "rotation_euler_deg": [math.degrees(a) for a in o.rotation_euler],
                    "scale": list(o.scale), "dimensions": list(o.dimensions),
                    "world_bbox_min": list(mn), "world_bbox_max": list(mx), "mesh": _mesh_stats(o),
                    "custom_properties": {k: (o[k] if isinstance(o[k], (int, float, str, bool)) else str(o[k])) for k in o.keys()}})
    meshes = [o for o in objs if o.type == "MESH"]
    main = max(meshes, key=lambda o: o.dimensions.x * o.dimensions.y * o.dimensions.z, default=None)
    mats = [{"name": m.name, "users": m.users,
             "principled": _principled(m)} for m in bpy.data.materials]
    cams = [{"name": o.name, "lens_mm": o.data.lens, "sensor_width": o.data.sensor_width,
             "location": list(o.location), "rotation_euler_deg": [math.degrees(a) for a in o.rotation_euler]} for o in objs if o.type == "CAMERA"]
    if objs:
        mns = [_world_bbox(o)[0] for o in meshes] or [Vector((0, 0, 0))]
        mxs = [_world_bbox(o)[1] for o in meshes] or [Vector((0, 0, 0))]
        omn = Vector((min(p.x for p in mns), min(p.y for p in mns), min(p.z for p in mns)))
        omx = Vector((max(p.x for p in mxs), max(p.y for p in mxs), max(p.z for p in mxs)))
    else:
        omn = omx = Vector((0, 0, 0))
    audit = {
        "source_blend": source_blend or None,
        "existing_model_found": bool(source_blend),
        "finding": ("Audited the supplied .blend." if source_blend else
                    "No existing .blend for this building was found: not in the repository, its git history, or the build container. "
                    "The audit below is of the empty starting scene, and the reconstruction starts from it. "
                    "If a .blend exists elsewhere, re-run with --blend and the reconstruction is added beside it without touching it."),
        "blender_version": bpy.app.version_string,
        "unit_system": sc.unit_settings.system, "scale_length": sc.unit_settings.scale_length,
        "up_axis": "Z (Blender)", "collections": coll_tree(sc.collection),
        "object_count": len(objs), "mesh_count": len(meshes),
        "main_building_mass": main.name if main else None,
        "facade_geometry_detected": [o.name for o in meshes if any(k in o.name.lower() for k in ("facade", "glass", "curtain", "mullion"))],
        "cameras": cams,
        "render": {"engine": sc.render.engine, "resolution": [sc.render.resolution_x, sc.render.resolution_y],
                   "resolution_percentage": sc.render.resolution_percentage, "fps": sc.render.fps},
        "scale_and_orientation": ("No geometry to measure." if not meshes else
                                  f"Mesh bounds {list(omn)} to {list(omx)} m."),
        "backup": None,
    }
    dims = {"overall_world_bbox_min": list(omn), "overall_world_bbox_max": list(omx),
            "overall_size_m": list(omx - omn),
            "per_object": {o.name: list(o.dimensions) for o in meshes}}
    return audit, inv, mats, dims


def _principled(m):
    try:
        b = m.node_tree.nodes.get("Principled BSDF")
        return {"base_color": list(b.inputs["Base Color"].default_value), "metallic": b.inputs["Metallic"].default_value,
                "roughness": b.inputs["Roughness"].default_value}
    except Exception:
        return None


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=lambda x: list(x) if hasattr(x, "__iter__") else str(x))


# =============================================================== render ====
def setup_world(sc, az=125, el=38):
    w = bpy.data.worlds.get("SKY_World") or bpy.data.worlds.new("SKY_World")
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
    try:
        sky.sun_elevation = math.radians(el); sky.sun_rotation = math.radians(90 - az)
        sky.altitude = 80; sky.air_density = 1.0; sky.aerosol_density = 1.0; sky.sun_intensity = 0.5
    except Exception:
        pass
    nt.links.new(sky.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = 0.35
    sun = bpy.data.lights.get("SKY_Sun") or bpy.data.lights.new("SKY_Sun", "SUN")
    sun.energy = 3.0; sun.angle = math.radians(1.2); sun.color = (1, 0.95, 0.86)
    so = bpy.data.objects.get("SKY_Sun") or bpy.data.objects.new("SKY_Sun", sun)
    if so.name not in sc.collection.objects:
        sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(90 - el), 0, math.radians(-az))
    return so


def render_ground(F, size=600.0):
    """A plain ground for the stills only. It sits outside the reconstruction
    collection and is not exported."""
    c = bpy.data.collections.get("SKY_RenderOnly")
    if c is None:
        c = bpy.data.collections.new("SKY_RenderOnly")
        bpy.context.scene.collection.children.link(c)
    if "sky_render_ground" not in MATS:
        MATS["sky_render_ground"] = _material("SKY_RenderOnly_Ground", "#7d7f78", 0.0, 0.95)
    mb = MeshBuilder("SKY_RenderOnly_Ground")
    mb.box((-size, -size, -0.6), (size, size, -0.3), "sky_render_ground")
    return mb.to_object(c, {"sky_component": "render_only"})


def make_camera(name, loc, look, lens=35.0, sensor=36.0, ortho=None, shift=(0, 0)):
    cd = bpy.data.cameras.get(name) or bpy.data.cameras.new(name)
    cd.lens, cd.sensor_width, cd.clip_start, cd.clip_end = lens, sensor, 0.1, 5000
    cd.sensor_fit = "AUTO"
    if ortho:
        cd.type = "ORTHO"; cd.ortho_scale = ortho
    cd.shift_x, cd.shift_y = shift
    ob = bpy.data.objects.get(name) or bpy.data.objects.new(name, cd)
    coll = sub_collection("Cameras")
    if ob.name not in coll.objects:
        coll.objects.link(ob)
    ob.location = loc
    d = Vector(look) - Vector(loc)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def reference_camera(P, F):
    rc = P["reference_camera"]
    yaw = math.radians(rc["yaw_from_front_normal_deg"])
    dist = rc["distance_to_corner_m"]
    # camera sits in front of A (-Y), swung toward side B (-X)
    loc = (-math.sin(yaw) * dist, -math.cos(yaw) * dist, rc["height_m"])
    cam = make_camera("SKY_Cam_Reference_Photo", loc, rc["look_at"], lens=rc["lens_mm"], sensor=rc["sensor_width_mm"])
    cam["sky_confidence"] = rc["confidence"]; cam["sky_source"] = rc["source"]
    return cam


def render_views(P, F, out_dir, samples=48, preview=False):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 6
    sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    W, L, H = F.W, F.L, F.H
    cx, cy = W / 2, (L - P["annex"]["depth"]) / 2
    views = {
        "01_reference_camera": (reference_camera(P, F), P["reference_camera"]["aspect"]),
        "02_front_elevation": (make_camera("SKY_Cam_Front_Elevation", (cx, -120, H / 2), (cx, 0, H / 2), ortho=max(W, H) * 1.35), (1200, 1000)),
        "03_side_elevation": (make_camera("SKY_Cam_Side_Elevation", (-120, cy, H / 2), (0, cy, H / 2), ortho=max(L, H) * 1.2), (1400, 900)),
        "04_three_quarter": (make_camera("SKY_Cam_Three_Quarter", (-48, -62, 34), (cx - 2, cy, 9), lens=30), (1400, 1000)),
    }
    os.makedirs(out_dir, exist_ok=True)
    paths = {}
    for k, (cam, (rx, ry)) in views.items():
        sc.camera = cam
        sc.render.resolution_x, sc.render.resolution_y = rx, ry
        sc.render.resolution_percentage = 100
        p = os.path.join(out_dir, k + ".jpg")
        sc.render.image_settings.file_format = "JPEG"
        sc.render.image_settings.quality = 90
        sc.render.filepath = p
        bpy.ops.render.render(write_still=True)
        paths[k] = p
        print("rendered", p)
    return paths


def render_preview(path):
    sc = bpy.context.scene
    # Cycles on the CPU: Workbench and EEVEE need a GPU context (EGL), which a
    # headless build machine does not have.
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 4
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 800, 600, 100
    if not sc.camera:
        cd = bpy.data.cameras.new("SKY_Audit_Cam")
        cam = bpy.data.objects.new("SKY_Audit_Cam", cd)
        sc.collection.objects.link(cam)
        cam.location = (-40, -50, 30)
        cam.rotation_euler = (Vector((10, 10, 8)) - Vector(cam.location)).to_track_quat("-Z", "Y").to_euler()
        sc.camera = cam
        temp = cam
    else:
        temp = None
    sc.render.image_settings.file_format = "PNG"
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    if temp:
        bpy.data.objects.remove(temp)
    return path


# ================================================================ build ====
def build(P):
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
    objs += generate_roof_and_site(P, F)
    # root empty at the footprint centre, so the exported model is centred
    root = bpy.data.objects.get(ROOT_NAME) or bpy.data.objects.new(ROOT_NAME, None)
    if root.name not in bpy.data.collections[COLL_NAME].objects:
        bpy.data.collections[COLL_NAME].objects.link(root)
    cx, cy = F.W / 2, (F.L - P["annex"]["depth"]) / 2
    root.location = (0, 0, 0)
    for o in objs:
        o.location = (o.location.x - cx, o.location.y - cy, o.location.z)
        o.parent = root
    root.location = (cx, cy, 0)
    root["sky_component"] = "root"
    root["sky_source"] = "facade_parameters.json"
    root["sky_note"] = "Children are in metres relative to the footprint centre. Elevation A (front, main glass) faces -Y; side B faces -X."
    root["sky_footprint_centre_local"] = [cx, cy]
    return root, objs


# ========================================================= export/check ===
def export_glb(path, root):
    bpy.ops.object.select_all(action="DESELECT")
    keep = [root] + list(root.children_recursive)
    for o in keep:
        o.select_set(True)
    loc = root.location.copy()
    root.location = (0, 0, 0)  # model origin = footprint centre at ground
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_normals=True, export_texcoords=True,
                              export_materials="EXPORT", export_extras=True, export_image_format="NONE")
    root.location = loc
    return path


def validate_glb(path, expected):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    objs = list(bpy.data.objects)
    meshes = [o for o in objs if o.type == "MESH"]
    names = {o.name for o in objs}
    missing = [n for n in expected["names"] if n not in names]
    mats = sorted({m.name for o in meshes for m in o.data.materials if m})
    no_uv = [o.name for o in meshes if not o.data.uv_layers]
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    root = bpy.data.objects.get(ROOT_NAME)
    extras_ok = sum(1 for o in meshes if "sky_confidence" in o.keys())
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
    return {
        "glb": os.path.basename(path), "bytes": os.path.getsize(path),
        "reopened": True, "objects": len(objs), "meshes": len(meshes), "triangles": tris,
        "root_found": bool(root), "children_of_root": len(root.children_recursive) if root else 0,
        "names_expected": len(expected["names"]), "names_missing": missing,
        "materials": mats, "materials_missing": [m for m in expected["materials"] if m not in mats],
        "meshes_without_uv": no_uv, "custom_properties_kept_on_meshes": extras_ok,
        "bounds_min_m": [round(v, 2) for v in mn], "bounds_max_m": [round(v, 2) for v in mx],
        "size_m": [round(v, 2) for v in (mx - mn)],
        "expected_height_m": round(expected["height"], 2),
        "scale_ok": abs((mx - mn).z - expected["height"]) < 0.05,
        "pass": not missing and not no_uv and bool(root) and abs((mx - mn).z - expected["height"]) < 0.05,
    }


# ================================================================== main ===
def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--params", required=True)
    ap.add_argument("--out", required=True, help="folder that holds reconstruction/, renders/, exports/")
    ap.add_argument("--blend", default=None, help="existing .blend to build beside (never edited in place)")
    ap.add_argument("--samples", type=int, default=48)
    ap.add_argument("--notes", default=None, help="JSON with the visual comparison against the photo")
    ap.add_argument("--skip-render", action="store_true")
    a = ap.parse_args(argv)
    P = json.load(open(a.params, encoding="utf-8"))
    rec, ren, exp = (os.path.join(a.out, d) for d in ("reconstruction", "renders", "exports"))
    for d in (rec, ren, exp):
        os.makedirs(d, exist_ok=True)

    # 1. open or start, back up, audit
    if a.blend:
        bpy.ops.wm.open_mainfile(filepath=a.blend)
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.preferences.filepaths.save_version = 0   # no .blend1 copies (set after the load, which resets it)
    backup = os.path.join(exp, "fm_skymark_base_backup.blend")
    if a.blend:
        shutil.copy2(a.blend, backup)
    else:
        bpy.ops.wm.save_as_mainfile(filepath=backup, copy=True)
    audit, inv, mats, dims = audit_scene(rec, a.blend, None)
    audit["backup"] = os.path.relpath(backup, a.out)
    write_json(os.path.join(rec, "scene_audit.json"), audit)
    write_json(os.path.join(rec, "object_inventory.json"), inv)
    write_json(os.path.join(rec, "existing_materials.json"), mats)
    write_json(os.path.join(rec, "existing_dimensions.json"), dims)
    render_preview(os.path.join(rec, "scene_preview.png"))

    # 2. build
    root, objs = build(P)
    F = Frame(P)
    setup_world(bpy.context.scene)
    render_ground(F)
    reference_camera(P, F)

    # 3. render
    renders = {} if a.skip_render else render_views(P, F, ren, samples=a.samples)

    # 4. save + export
    final_blend = os.path.join(exp, "fm_skymark_final.blend")
    bpy.context.scene.camera = bpy.data.objects.get("SKY_Cam_Reference_Photo")
    bpy.ops.wm.save_as_mainfile(filepath=final_blend)
    expected = {"names": [ROOT_NAME] + [o.name for o in objs],
                "materials": sorted({m.name for o in objs if o.type == "MESH" for m in o.data.materials if m}),
                "height": max((_world_bbox(o)[1].z for o in objs if o.type == "MESH")) - min((_world_bbox(o)[0].z for o in objs if o.type == "MESH"))}
    inventory_built = [{"name": o.name, "component": o.get("sky_component"), "confidence": o.get("sky_confidence"),
                        "observed": o.get("sky_observed"), "source": o.get("sky_source"), "mesh": _mesh_stats(o),
                        "collection": o.users_collection[0].name if o.users_collection else None} for o in objs]
    glb = export_glb(os.path.join(exp, "fm_skymark_atlas.glb"), root)

    # 5. reopen and validate
    check = validate_glb(glb, expected)
    notes = json.load(open(a.notes, encoding="utf-8")) if a.notes and os.path.exists(a.notes) else {}
    confs = {}
    for r in inventory_built:
        confs[r["confidence"]] = confs.get(r["confidence"], 0) + 1
    report = {
        "building": P["meta"]["building"],
        "glb_validation": check,
        "renders": {k: os.path.relpath(v, a.out) for k, v in renders.items()},
        "components": inventory_built,
        "confidence_summary": confs,
        "unobserved_components": [r["name"] for r in inventory_built if r["observed"] is False],
        "photo_comparison": notes.get("photo_comparison", "Not yet compared."),
        "geometric_discrepancies": notes.get("geometric_discrepancies", []),
        "limitations": notes.get("limitations", []),
        "files": {"blend": os.path.relpath(final_blend, a.out), "glb": os.path.relpath(glb, a.out),
                  "backup": os.path.relpath(backup, a.out)},
    }
    write_json(os.path.join(rec, "validation_report.json"), report)
    print(json.dumps(check, indent=1))
    return 0 if check["pass"] else 2


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    sys.exit(main(argv))
