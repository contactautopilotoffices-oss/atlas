"""fc_build.py (procedural-cad copy of the scratch prototype, adapted for the RTP floor) - JSON spec -> FreeCAD BIM model (.FCStd) + IFC4 (.ifc) + web mesh (.mesh.json).

Headless: runs inside FreeCAD 1.1 `freecadcmd` (needs FreeCAD, Part, Arch, ifcopenshell).

    import fc_build
    report = fc_build.build(spec_dict, "/abs/path/out/prefix")
    # -> prefix.FCStd, prefix.ifc, prefix.mesh.json, prefix.report.json

Spec units are metres; FreeCAD works in mm internally (MM factor below).
See README.md for the spec shape and the IFC structure produced.
"""

import json
import math
import os
import time
import uuid

import FreeCAD
import Part

MM = 1000.0
EPS = 1e-6
_NS = uuid.UUID("6f1c0a52-3c1e-4d8e-9a43-5b1d2b0c9e11")

# default band material per wall type (used when a wall has no "bands")
TYPE_DEFAULT_MATERIAL = {
    "glass_partition": "glass", "full_height_glass": "glass", "pop_gypsum": "pop",
    "brick_block": "brick", "rcc": "rcc", "acp": "acp", "curtain_wall": "glass",
}
# IFC4 IfcWallTypeEnum per wall type
TYPE_WALL_PREDEF = {
    "glass_partition": "PARTITIONING", "full_height_glass": "PARTITIONING",
    "pop_gypsum": "PARTITIONING", "brick_block": "SOLIDWALL", "rcc": "SHEAR", "acp": "USERDEFINED",
}
DOOR_KINDS = ("door_single", "door_double", "glass_door")
WINDOW_KINDS = ("window", "arch_window")
VOID_KINDS = ("arch", "opening")


def gid(key):
    """Deterministic IFC GlobalId from a spec key (stable across rebuilds -> diffable IFC)."""
    import ifcopenshell.guid
    return ifcopenshell.guid.compress(uuid.uuid5(_NS, str(key)).hex)


def V(x, y, z=0.0):
    return FreeCAD.Vector(x * MM, y * MM, z * MM)


class Timer:
    def __init__(self):
        self.t = {}
        self.n = {}

    def add(self, key, dt, n=1):
        self.t[key] = self.t.get(key, 0.0) + dt
        self.n[key] = self.n.get(key, 0) + n

    def report(self):
        return {k: {"total_s": round(v, 4), "count": self.n[k],
                    "per_item_ms": round(1000 * v / max(1, self.n[k]), 3)} for k, v in self.t.items()}


# ----------------------------------------------------------------------------- geometry helpers

def _seg_len(a, b):
    return math.hypot(b[0] - a[0], b[1] - a[1])


def locate_on_polyline(pts, centre=None, offset=None):
    """Return (point(x,y), unit dir(ux,uy), seg index) on a polyline, from a 2D centre
    (nearest projection) or an offset along the polyline from its first point (metres)."""
    segs = list(zip(pts[:-1], pts[1:]))
    if offset is not None:
        acc = 0.0
        for i, (a, b) in enumerate(segs):
            L = _seg_len(a, b)
            if offset <= acc + L + EPS or i == len(segs) - 1:
                t = (offset - acc) / L
                u = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
                return (a[0] + u[0] * L * t, a[1] + u[1] * L * t), u, i
            acc += L
    best = None
    for i, (a, b) in enumerate(segs):
        L = _seg_len(a, b)
        u = ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
        t = max(0.0, min(L, (centre[0] - a[0]) * u[0] + (centre[1] - a[1]) * u[1]))
        p = (a[0] + u[0] * t, a[1] + u[1] * t)
        d = _seg_len(p, centre)
        if best is None or d < best[0]:
            best = (d, p, u, i)
    return best[1], best[2], best[3]


class Frame2:
    """Local opening frame: s along wall, z up, n = u x Z (wall normal)."""

    def __init__(self, p, u):
        self.p, self.u = p, u
        self.n = (u[1], -u[0])

    def P(self, s, z, w=0.0):
        return V(self.p[0] + self.u[0] * s + self.n[0] * w, self.p[1] + self.u[1] * s + self.n[1] * w, z)

    @property
    def nvec(self):
        return FreeCAD.Vector(self.n[0], self.n[1], 0)


def poly_wire(fr, pts_sz):
    pts = [fr.P(s, z) for s, z in pts_sz]
    return Part.makePolygon(pts + [pts[0]])


def rect_sz(s0, s1, z0, z1):
    return [(s0, z0), (s1, z0), (s1, z1), (s0, z1)]


def arch_geom(half_w, spring, radius):
    """Centre z and apex z of a semicircular / segmental arch on jambs at +-half_w."""
    r = max(radius, half_w)  # radius < half width is not a valid arch: clamp
    cz = spring - math.sqrt(max(0.0, r * r - half_w * half_w))
    return cz, cz + r, r


def arch_wire(fr, half_w, sill, spring, radius):
    cz, apex, r = arch_geom(half_w, spring, radius)
    a = fr.P(-half_w, sill)
    b = fr.P(half_w, sill)
    c = fr.P(half_w, spring)
    top = fr.P(0, apex)
    d = fr.P(-half_w, spring)
    edges = [Part.LineSegment(a, b).toShape(), Part.LineSegment(b, c).toShape(),
             Part.Arc(c, top, d).toShape(), Part.LineSegment(d, a).toShape()]
    return Part.Wire(edges)


def arch_inner_wire(fr, half_w, sill, spring, radius, fw):
    """Arch outline offset inwards by frame width fw (same arch centre)."""
    cz, apex, r = arch_geom(half_w, spring, radius)
    hi, ri = half_w - fw, r - fw
    zj = cz + math.sqrt(max(0.0, ri * ri - hi * hi))  # where inner jamb meets inner arc
    a = fr.P(-hi, sill + fw)
    b = fr.P(hi, sill + fw)
    c = fr.P(hi, zj)
    top = fr.P(0, cz + ri)
    d = fr.P(-hi, zj)
    edges = [Part.LineSegment(a, b).toShape(), Part.LineSegment(b, c).toShape(),
             Part.Arc(c, top, d).toShape(), Part.LineSegment(d, a).toShape()]
    return Part.Wire(edges)


def through_solid(fr, wire, depth_m):
    """Extrude a wire (in the wall centre plane) symmetrically through the wall."""
    f = Part.Face(wire)
    n = fr.nvec
    f.translate(n * (-depth_m * MM / 2))
    return f.extrude(n * (depth_m * MM))


def parse_profile(p, default=(50.0, 100.0)):
    try:
        a, b = str(p).lower().split("x")
        return float(a), float(b)
    except Exception:
        return default


# ----------------------------------------------------------------------------- builder

class Builder:
    def __init__(self, spec, out_prefix, assembly_mode="buildingpart"):
        import Arch  # noqa: F401  (BIM workbench, works headless)
        self.spec = spec
        self.out_prefix = out_prefix
        self.assembly_mode = assembly_mode
        self.T = Timer()
        self.reg = {}          # FreeCAD Name -> registry dict (for IFC post-pass + mesh export)
        self.wall_objs = {}    # spec wall id -> {"pieces": [(z0,z1,obj)], "spec": w, "thick": t}
        self.mats = {}
        self.multimats = {}
        self.storey_objs = []
        self.warnings = []
        name = spec.get("name", "fcproto")
        t0 = time.time()
        import ifcopenshell.guid  # noqa: F401  first import costs ~2.5 s; keep it out of per-element timings
        import ArchWall, ArchWindow, ArchStructure, ArchCurtainWall, ArchBuildingPart  # noqa: F401,E401
        self.T.add("warm-up imports (one-off)", time.time() - t0)
        self.doc = FreeCAD.newDocument(name)

    # ---------------------------------------------------------------- props / registry
    def _set_ifc(self, obj, spec_id, role, ifc_type=None, predefined=None, object_type=None,
                 props=None, extra=None, material_key=None, part_materials=None):
        import Arch  # noqa: F401
        if ifc_type:
            obj.IfcType = ifc_type
        if predefined and "PredefinedType" in obj.PropertiesList:
            try:
                obj.PredefinedType = predefined
            except Exception as e:
                self.warnings.append(f"{spec_id}: PredefinedType {predefined} rejected: {e}")
        if object_type and "ObjectType" in obj.PropertiesList:
            obj.ObjectType = object_type
        g = gid(f"{spec_id}|{role}")
        d = dict(obj.IfcData)
        d["IfcUID"] = g
        obj.IfcData = d
        if "GlobalId" in obj.PropertiesList:
            obj.GlobalId = g
        # IfcProperties (App::PropertyMap) -> exported by importers.exportIFC as IfcPropertySet:
        #   key "propname;;PsetName", value "IfcType;;value"
        pm = {}

        def put(pset, k, v):
            if v is None:
                return
            if isinstance(v, bool):
                t, sv = "IfcBoolean", ("True" if v else "False")
            elif isinstance(v, int):
                t, sv = "IfcInteger", str(v)
            elif isinstance(v, float):
                t, sv = "IfcReal", repr(v)
            else:
                sv = v if isinstance(v, str) else json.dumps(v)
                t = "IfcText" if len(sv) > 255 else "IfcLabel"
            sv = sv.replace(";;", "; ;")
            if sv == "":
                return
            pm[f"{k};;{pset}"] = f"{t};;{sv}"

        for k, v in (props or {}).items():
            put("Pset_CADSource", k, v)
        put("Pset_SemanticCAD", "spec_id", spec_id)
        put("Pset_SemanticCAD", "role", role)
        for k, v in (extra or {}).items():
            put("Pset_SemanticCAD", k, v)
        obj.IfcProperties = pm
        self.reg[obj.Name] = {"id": spec_id, "role": role, "guid": g, "ifc_type": obj.IfcType,
                              "material": material_key, "part_materials": part_materials,
                              "label": obj.Label}
        return g

    # ---------------------------------------------------------------- materials
    def build_materials(self):
        import Arch
        t0 = time.time()
        for key, m in self.spec.get("materials", {}).items():
            mat = Arch.makeMaterial(name=m.get("ifc_name", key), color=tuple(m.get("color", (0.8, 0.8, 0.8))),
                                    transparency=m.get("transparency", 0))
            mat.addProperty("App::PropertyString", "SpecKey", "fcproto")  # lets export_mesh() work on a reopened FCStd
            mat.SpecKey = key
            self.mats[key] = mat
        self.T.add("materials", time.time() - t0, max(1, len(self.mats)))

    def _mat(self, key):
        if key not in self.mats:
            import Arch
            self.warnings.append(f"material '{key}' not in spec.materials; created grey default")
            self.mats[key] = Arch.makeMaterial(name=key, color=(0.7, 0.7, 0.7))
        return self.mats[key]

    def _multimat(self, layers, label):
        import Arch
        k = tuple((l["material"], round(l["thickness_m"], 5), l.get("name", "")) for l in layers)
        if k in self.multimats:
            return self.multimats[k]
        mm = Arch.makeMultiMaterial(name=label)
        mm.Names = [l.get("name", l["material"]) for l in layers]
        mm.Materials = [self._mat(l["material"]) for l in layers]
        mm.Thicknesses = [l["thickness_m"] * MM for l in layers]
        self.multimats[k] = mm
        return mm

    # ---------------------------------------------------------------- walls
    def _axis(self, label, pts, z):
        base = self.doc.addObject("Part::Feature", label + "_axis")
        base.Shape = Part.makePolygon([V(x, y, z) for x, y in pts])
        return base

    def _wall_piece(self, label, pts, z, thick, height, material):
        import Arch
        base = self._axis(label, pts, z)
        w = Arch.makeWall(base, width=thick * MM, height=height * MM, align="Center", name=label)
        w.Material = material
        return w

    def build_walls(self):
        for w in self.spec.get("walls", []):
            t0 = time.time()
            if w["type"] == "curtain_wall":
                self._curtain_wall(w)
                self.T.add("curtain_wall", time.time() - t0)
                continue
            H, z_base, th = w["height_m"], w.get("base_z_m", 0.0), w["thickness_m"]
            bands = w.get("bands") or [{"material": TYPE_DEFAULT_MATERIAL.get(w["type"], "pop"),
                                        "z0_m": 0.0, "z1_m": H}]
            props = w.get("props", {})
            band_str = "|".join(f"{b['material']}:{b['z0_m']:.3f}-{b['z1_m']:.3f}" for b in bands)
            predef = TYPE_WALL_PREDEF.get(w["type"], "STANDARD")
            pieces = []
            if len(bands) == 1:
                b = bands[0]
                if w.get("layers"):
                    mat = self._multimat(w["layers"], f"{w['id']} layers")
                    mkey = None
                    parts = [l["material"] for l in w["layers"]]
                else:
                    mat, mkey, parts = self._mat(b["material"]), b["material"], None
                obj = self._wall_piece(w["id"], w["centreline"], z_base + b["z0_m"], th,
                                       b["z1_m"] - b["z0_m"], mat)
                self._set_ifc(obj, w["id"], "wall", w.get("ifc_type") or "Wall", w.get("predefined") or predef,
                              object_type=w["type"], props=props,
                              extra={"wall_type": w["type"], "bands": band_str,
                                     "layers": json.dumps(w.get("layers")) if w.get("layers") else None},
                              material_key=mkey, part_materials=parts)
                if w.get("layers"):
                    self.reg[obj.Name]["layers"] = w["layers"]
                pieces.append((z_base + b["z0_m"], z_base + b["z1_m"], obj))
                self.storey_objs.append(obj)
                self.T.add("wall_single_band", time.time() - t0)
            else:
                band_objs = []
                for i, b in enumerate(bands):
                    lab = f"{w['id']}.b{i}.{b['material']}"
                    obj = self._wall_piece(lab, w["centreline"], z_base + b["z0_m"], th,
                                           b["z1_m"] - b["z0_m"], self._mat(b["material"]))
                    self._set_ifc(obj, w["id"], f"band{i}", "Wall", w.get("predefined") or predef, object_type=f"{w['type']}_band_{b['material']}",
                                  props=props,
                                  extra={"wall_type": w["type"], "band_index": i, "band_material": b["material"],
                                         "z0_m": float(b["z0_m"]), "z1_m": float(b["z1_m"]),
                                         "parent_assembly": w["id"]},
                                  material_key=b["material"])
                    band_objs.append(obj)
                    pieces.append((z_base + b["z0_m"], z_base + b["z1_m"], obj))
                asm = self._assembly(w["id"], band_objs, props,
                                     {"assembly_type": w["type"], "bands": band_str, "band_count": len(bands)})
                self.storey_objs.append(asm)
                self.T.add("wall_multi_band", time.time() - t0)
            self.wall_objs[w["id"]] = {"pieces": pieces, "spec": w, "thick": th}

    def _assembly(self, sid, children, props, extra):
        import Arch
        if self.assembly_mode == "app_part":
            asm = self.doc.addObject("App::Part", sid)
            asm.Label = sid
            for c in children:
                asm.addObject(c)
            # App::Part has no IfcProperties/IfcData: add them so the exporter picks them up
            asm.addProperty("App::PropertyMap", "IfcProperties", "IFC")
            asm.addProperty("App::PropertyMap", "IfcData", "IFC")
            asm.addProperty("App::PropertyString", "IfcType", "IFC")
            asm.IfcType = "Element Assembly"
            self._set_ifc(asm, sid, "assembly", None, props=props, extra=extra)
        else:
            asm = Arch.makeBuildingPart(children, name=sid)
            self._set_ifc(asm, sid, "assembly", "Element Assembly", "USERDEFINED",
                          object_type=extra.get("assembly_type"), props=props, extra=extra)
        self.reg[asm.Name]["children"] = [c.Name for c in children]
        for c in children:
            self.reg[c.Name]["parent"] = sid
        return asm

    def _curtain_wall(self, w):
        import Arch
        c = w.get("curtain", {})
        base = self._axis(w["id"], w["centreline"], w.get("base_z_m", 0.0))
        cw = Arch.makeCurtainWall(base, name=w["id"])
        cw.Height = w["height_m"] * MM
        segs = list(zip(w["centreline"][:-1], w["centreline"][1:]))
        mean_len = sum(_seg_len(a, b) for a, b in segs) / len(segs)
        cw.VerticalSections = max(1, int(round(mean_len / c.get("spacing_m", 1.2))))
        cw.HorizontalSections = int(c.get("horizontal_sections", 2))
        mw, md = c.get("mullion_mm", [50, 150])
        cw.VerticalMullionWidth = mw
        cw.VerticalMullionHeight = md
        cw.HorizontalMullionWidth = mw
        cw.HorizontalMullionHeight = md
        cw.PanelThickness = c.get("panel_thickness_mm", 24)
        mm_mat = c.get("mullion_material", "aluminium")
        pn_mat = c.get("panel_material", "glass")
        cw.Material = self._mat(pn_mat)
        self._set_ifc(cw, w["id"], "curtain_wall", "Curtain Wall", "NOTDEFINED", props=w.get("props", {}),
                      extra={"wall_type": "curtain_wall", "vertical_sections_per_face": cw.VerticalSections,
                             "horizontal_sections": cw.HorizontalSections,
                             "mullion_material": mm_mat, "panel_material": pn_mat},
                      material_key=pn_mat)
        self.reg[cw.Name]["curtain"] = {"mullion_material": mm_mat, "panel_material": pn_mat}
        self.storey_objs.append(cw)

    # ---------------------------------------------------------------- openings
    def _hosts(self, wid, z0, z1):
        info = self.wall_objs.get(wid)
        if not info:
            return [], 0.0, None
        hosts = [o for (a, b, o) in info["pieces"] if a < z1 - EPS and b > z0 + EPS]
        return hosts, info["thick"], info

    def _band_material_at(self, info, z):
        for (a, b, o) in info["pieces"]:
            if a - EPS <= z <= b + EPS:
                return o.Material, self.reg[o.Name].get("material")
        o = info["pieces"][-1][2]
        return o.Material, self.reg[o.Name].get("material")

    def build_openings(self):
        import Arch
        for op in self.spec.get("openings", []):
            t0 = time.time()
            info = self.wall_objs.get(op["host_wall_id"]) if op.get("host_wall_id") else None
            if info:
                ws = info["spec"]
                p, u, seg = locate_on_polyline(ws["centreline"], op.get("centre"), op.get("offset_m"))
                if op.get("line"):
                    # keep the door on its drawn opening line (the gap between the wall ends); the host only gives the direction
                    (ax_, ay_), (bx_, by_) = op["line"]
                    p = ((ax_ + bx_) / 2, (ay_ + by_) / 2)
            else:
                # no host wall found in the drawing: build the door on its own drawn opening line, nothing is cut
                (ax_, ay_), (bx_, by_) = op["line"]
                L_ = math.hypot(bx_ - ax_, by_ - ay_) or 1.0
                p, u, seg = ((ax_ + bx_) / 2, (ay_ + by_) / 2), ((bx_ - ax_) / L_, (by_ - ay_) / L_), -1
                ws = {"base_z_m": 0.0}
                self.warnings.append(f"{op['id']}: no host wall; door built standalone on its drawn opening line")
            fr = Frame2(p, u)
            zb = ws.get("base_z_m", 0.0)
            w = op["width_m"]
            h2 = w / 2
            sill = zb + op.get("sill_m", 0.0)
            head = zb + op.get("head_m", 2.1)
            hdr = op.get("header") or {}
            hk = hdr.get("kind")
            hz0 = zb + hdr.get("z0_m", op.get("head_m", 2.1))
            hz1 = zb + hdr.get("z1_m", op.get("head_m", 2.1))
            fw_mm, fd_mm = parse_profile((op.get("frame") or {}).get("profile_mm", "50x100"))
            fw, fd = fw_mm / MM, fd_mm / MM
            kind = op["kind"]
            props = op.get("props", {})
            # top of the cut: headers that are separate pieces replace the wall above the head
            cut_top = head
            if hk in ("pop_bulkhead", "glass_transom", "full_height", "lintel_masonry"):
                cut_top = max(head, hz1)
            if kind in ("arch", "arch_window"):
                cz, apex, r = arch_geom(h2, zb + op["arch"]["spring_m"], op["arch"]["radius_m"])
                cut_top = apex
            if info:
                hosts, th, _ = self._hosts(op["host_wall_id"], sill, cut_top)
                if not hosts:
                    self.warnings.append(f"{op['id']}: no host band overlaps z {sill}-{cut_top}")
            else:
                hosts, th = [], 0.1
            depth = th + 0.1
            extra = {"kind": kind, "host_wall_id": op["host_wall_id"], "width_m": float(w),
                     "sill_m": float(op.get("sill_m", 0.0)), "head_m": float(op.get("head_m", 0.0)),
                     "header_kind": hk, "frame_profile_mm": (op.get("frame") or {}).get("profile_mm"),
                     "host_pieces": ",".join(h.Label for h in hosts), "segment_index": seg}

            # --- pure voids (no fill): host.Subtractions -> IfcOpeningElement
            if kind in VOID_KINDS:
                if kind == "arch":
                    wire = arch_wire(fr, h2, sill, zb + op["arch"]["spring_m"], op["arch"]["radius_m"])
                    extra.update({"arch_spring_m": float(op["arch"]["spring_m"]),
                                  "arch_radius_m": float(op["arch"]["radius_m"])})
                else:
                    wire = poly_wire(fr, rect_sz(-h2, h2, sill, head))
                vol = self.doc.addObject("Part::Feature", op["id"])
                vol.Label = op["id"]  # addObject sanitises the Name ("O-1" -> "O_1"); IFC opening Name = Label
                vol.Shape = through_solid(fr, wire, depth)
                for h in hosts:
                    h.Subtractions = h.Subtractions + [vol]
                self.reg[vol.Name] = {"id": op["id"], "role": "void", "guid": None, "ifc_type": "Opening Element",
                                      "material": None, "label": vol.Label, "void_extra": extra,
                                      "props": props, "hosts": [h.Name for h in hosts]}
                self.T.add("opening_void", time.time() - t0)
                continue

            # --- filled openings: Arch Window (door or window) hosted in the wall pieces
            wires, parts, part_mats = [], [], []
            fmat = (op.get("frame") or {}).get("material", "aluminium")
            lmat = op.get("leaf_material", "glass" if kind in ("glass_door",) + WINDOW_KINDS else "timber")
            leaf_type = "Glass panel" if lmat == "glass" else "Solid panel"
            leaf_thk = float(op.get("leaf_thickness_mm") or (12.0 if lmat == "glass" else 40.0))
            if kind in DOOR_KINDS:
                ftop = head if hk not in ("glass_transom", "full_height") else cut_top
                U = [(-h2, sill), (-h2, ftop), (h2, ftop), (h2, sill), (h2 - fw, sill), (h2 - fw, ftop - fw),
                     (-h2 + fw, ftop - fw), (-h2 + fw, sill)]
                wires.append(poly_wire(fr, U))
                parts += ["Frame", "Frame", "Wire0", str(fd_mm), str(-fd_mm / 2)]
                part_mats.append(fmat)
                leaf_top = (head - fw) if hk != "full_height" else (cut_top - fw)
                if hk == "glass_transom":
                    # transom bar under the transom glass, part of the door frame
                    wires.append(poly_wire(fr, rect_sz(-h2 + fw, h2 - fw, head - fw, head)))
                    parts += ["TransomBar", "Frame", f"Wire{len(wires) - 1}", str(fd_mm), str(-fd_mm / 2)]
                    part_mats.append(fmat)
                    leaf_top = head - fw
                g = 0.003
                if kind == "door_double":
                    for side in (-1, 1):
                        s0, s1 = (-h2 + fw + g, -g) if side < 0 else (g, h2 - fw - g)
                        wires.append(poly_wire(fr, rect_sz(s0, s1, sill + 0.01, leaf_top - g)))
                        parts += [f"Leaf{'L' if side < 0 else 'R'}", leaf_type, f"Wire{len(wires) - 1}",
                                  str(leaf_thk), str(-leaf_thk / 2)]
                        part_mats.append(lmat)
                else:
                    wires.append(poly_wire(fr, rect_sz(-h2 + fw + g, h2 - fw - g, sill + 0.01, leaf_top - g)))
                    parts += ["Leaf", leaf_type, f"Wire{len(wires) - 1}", str(leaf_thk), str(-leaf_thk / 2)]
                    part_mats.append(lmat)
                ifc_type, predef = "Door", "DOOR"
                leaf_h = leaf_top - sill
            else:
                if kind == "arch_window":
                    sp = zb + op["arch"]["spring_m"]
                    wires.append(arch_wire(fr, h2, sill, sp, op["arch"]["radius_m"]))
                    wires.append(arch_inner_wire(fr, h2, sill, sp, op["arch"]["radius_m"], fw))
                    extra.update({"arch_spring_m": float(op["arch"]["spring_m"]),
                                  "arch_radius_m": float(op["arch"]["radius_m"])})
                else:
                    wires.append(poly_wire(fr, rect_sz(-h2, h2, sill, head)))
                    wires.append(poly_wire(fr, rect_sz(-h2 + fw, h2 - fw, sill + fw, head - fw)))
                parts += ["Frame", "Frame", "Wire0,Wire1", str(fd_mm), str(-fd_mm / 2)]
                parts += ["Glass", "Glass panel", "Wire1", "10", "-5"]
                part_mats += [fmat, "glass"]
                ifc_type, predef = "Window", "WINDOW"
                leaf_h = cut_top - sill
            base = self.doc.addObject("Part::Feature", op["id"] + "_profile")
            base.Shape = Part.makeCompound(wires)
            win = Arch.makeWindow(base, width=w * MM, height=leaf_h * MM, parts=parts, name=op["id"])
            win.Normal = fr.nvec
            # explicit cutting volume (covers the header zone too)
            if kind == "arch_window":
                cw = arch_wire(fr, h2, sill, zb + op["arch"]["spring_m"], op["arch"]["radius_m"])
            else:
                cw = poly_wire(fr, rect_sz(-h2, h2, sill, cut_top))
            sub = self.doc.addObject("Part::Feature", op["id"] + "_cut")
            sub.Shape = through_solid(fr, cw, depth)
            win.Subvolume = sub
            if hosts:
                win.Hosts = hosts
            win.Width = w * MM
            win.Height = leaf_h * MM
            win.Material = self._window_multimat(part_mats, parts)
            self._set_ifc(win, op["id"], "door" if ifc_type == "Door" else "window", ifc_type, predef,
                          props=props, extra=extra, part_materials=part_mats)
            self.reg[win.Name]["constituents"] = list(zip([parts[i * 5] for i in range(len(parts) // 5)], part_mats))
            self.reg[win.Name]["host_names"] = [h.Name for h in hosts]
            self.reg[win.Name]["overall"] = (w, leaf_h if ifc_type == "Window" else (cut_top - sill if hk == "full_height" else head - sill))
            self.storey_objs.append(win)
            # --- header piece
            if hk in ("pop_bulkhead", "lintel_masonry") and hz1 > head + EPS:
                # the header's material is the header record's (POP bulkhead = gypsum, lintel = block), not the host's:
                # a layered host has no single material key, and a host of unknown type must not colour a known header
                hkey = hdr.get("material") or (self._band_material_at(info, (head + hz1) / 2)[1] if info else None) or "pop"
                hmat = self._mat(hkey)
                pts = [(p[0] - u[0] * h2, p[1] - u[1] * h2), (p[0] + u[0] * h2, p[1] + u[1] * h2)]
                hobj = self._wall_piece(op["id"] + ".header", pts, head, th, hz1 - head, hmat)
                self._set_ifc(hobj, op["id"], "header", "Wall", "USERDEFINED", object_type="DOOR_HEADER_" + hk.upper(),
                              props=props, extra={"header_kind": hk, "host_opening": op["id"],
                                                  "host_wall_id": op["host_wall_id"],
                                                  "z0_m": head - zb, "z1_m": hz1 - zb},
                              material_key=hkey)
                self.storey_objs.append(hobj)
            elif hk == "glass_transom" and hz1 > head + EPS:
                gthk = hdr.get("thickness_m", 0.012)
                pts = [(p[0] - u[0] * (h2 - fw), p[1] - u[1] * (h2 - fw)), (p[0] + u[0] * (h2 - fw), p[1] + u[1] * (h2 - fw))]
                hobj = self._wall_piece(op["id"] + ".transom", pts, head, gthk, hz1 - head - fw, self._mat("glass"))
                self._set_ifc(hobj, op["id"], "header", "Plate", "USERDEFINED", object_type="DOOR_HEADER_GLASS_TRANSOM",
                              props=props, extra={"header_kind": hk, "host_opening": op["id"],
                                                  "host_wall_id": op["host_wall_id"],
                                                  "z0_m": head - zb, "z1_m": hz1 - zb},
                              material_key="glass")
                self.storey_objs.append(hobj)
            self.T.add("opening_" + ("door" if ifc_type == "Door" else "window"), time.time() - t0)

    def _window_multimat(self, part_mats, parts):
        """MultiMaterial whose layer names match the window part names (colours parts in the GUI)."""
        import Arch
        names = [parts[i * 5] for i in range(len(parts) // 5)]
        k = ("win",) + tuple(zip(names, part_mats))
        if k in self.multimats:
            return self.multimats[k]
        mm = Arch.makeMultiMaterial(name="window parts " + "/".join(sorted(set(part_mats))))
        mm.Names = names
        mm.Materials = [self._mat(m) for m in part_mats]
        mm.Thicknesses = [0.0] * len(names)
        self.multimats[k] = mm
        return mm

    # ---------------------------------------------------------------- structure
    def _face_feature(self, label, poly, z):
        f = self.doc.addObject("Part::Feature", label + "_profile")
        pts = [V(x, y, z) for x, y in poly]
        f.Shape = Part.Face(Part.makePolygon(pts + [pts[0]]))
        return f

    def build_structure(self):
        import Arch
        for c in self.spec.get("columns", []):
            t0 = time.time()
            base = self._face_feature(c["id"], c["poly"], c.get("base_z_m", 0.0))
            s = Arch.makeStructure(base, height=c["height_m"] * MM, name=c["id"])
            s.Normal = FreeCAD.Vector(0, 0, 1)   # extrude up whatever the outline's winding
            mk = c.get("material", "rcc")
            s.Material = self._mat(mk)
            self._set_ifc(s, c["id"], "column", "Column", "COLUMN", props=c.get("props", {}), material_key=mk)
            self.storey_objs.append(s)
            self.T.add("column", time.time() - t0)
        sl = self.spec.get("slab")
        if sl:
            t0 = time.time()
            base = self._face_feature(sl["id"], sl["poly"], sl["top_z_m"] - sl["thickness_m"])
            s = Arch.makeStructure(base, height=sl["thickness_m"] * MM, name=sl["id"])
            s.Normal = FreeCAD.Vector(0, 0, 1)
            mk = sl.get("material", "rcc")
            s.Material = self._mat(mk)
            self._set_ifc(s, sl["id"], "slab", "Slab", "FLOOR", props=sl.get("props", {}), material_key=mk)
            self.storey_objs.append(s)
            self.T.add("slab", time.time() - t0)
        cl = self.spec.get("ceiling")
        if cl:
            t0 = time.time()
            thk = cl.get("thickness_m", 0.0125)
            base = self._face_feature(cl["id"], cl["poly"], cl["z_m"])
            s = Arch.makeStructure(base, height=thk * MM, name=cl["id"])
            s.Normal = FreeCAD.Vector(0, 0, 1)
            mk = cl.get("material", "ceiling")
            s.Material = self._mat(mk)
            self._set_ifc(s, cl["id"], "ceiling", "Covering", "CEILING", props=cl.get("props", {}),
                          extra={"z_m": float(cl["z_m"])}, material_key=mk)
            self.storey_objs.append(s)
            self.T.add("ceiling", time.time() - t0)

    # ---------------------------------------------------------------- spatial
    def build_spatial(self):
        import Arch
        st = self.spec.get("storey", {})
        self.storey = Arch.makeFloor(self.storey_objs, name=st.get("name", "Level"))
        self.storey.Placement.Base.z = st.get("elevation_m", 0.0) * MM
        self.building = Arch.makeBuilding([self.storey], name=self.spec.get("building", "Building"))
        self.site = Arch.makeSite([self.building], name=self.spec.get("site", "Site"))
        for o, k in ((self.storey, "storey"), (self.building, "building"), (self.site, "site")):
            d = dict(o.IfcData)
            d["IfcUID"] = gid(f"{self.spec.get('name')}|{k}")
            o.IfcData = d

    # ---------------------------------------------------------------- run
    def run(self, recompute=True):
        tall = time.time()
        self.build_materials()
        self.build_walls()
        self.build_openings()
        self.build_structure()
        self.build_spatial()
        t0 = time.time()
        if recompute:
            self.doc.recompute()
        self.T.add("doc.recompute (all)", time.time() - t0)
        bad = [o.Label for o in self.doc.Objects if "Invalid" in o.State or "Error" in o.State]
        if bad:
            self.warnings.append("objects in error state after recompute: " + ", ".join(bad))
        self.T.add("build total", time.time() - tall)


# ----------------------------------------------------------------------------- IFC export + post-pass

def export_ifc(builder, path):
    import importers.exportIFC as exportIFC   # FreeCAD 1.x path (BIM workbench)
    prefs = exportIFC.getPreferences()
    prefs.update({"SCHEMA": "IFC4", "EXPORT_2D": False, "DEBUG": False, "STORE_UID": False,
                  "FULL_PARAMETRIC": False, "FORCE_BREP": False, "CREATE_CLONES": False})
    colors = {}
    for name, r in builder.reg.items():
        o = builder.doc.getObject(name)
        mk = r.get("material")
        if mk and mk in builder.mats:
            colors[name] = tuple(builder.mats[mk].Color[:3])
        elif r.get("part_materials"):
            colors[name] = tuple(builder.mats[r["part_materials"][0]].Color[:3])
    t0 = time.time()
    # ORDER MATTERS: the exporter skips any object already created as a sub-part of an assembly,
    # so assembly children exported *after* their assembly lose psets + openings. Passing the leaf
    # elements first (get_architectural_contents keeps the initial order) makes them full products.
    leaves = [builder.doc.getObject(n) for n, r in builder.reg.items()
              if r.get("role") not in ("assembly", "void") and builder.doc.getObject(n) is not None]
    exportIFC.export(leaves + [builder.site], path, colors=colors, preferences=prefs)
    builder.T.add("ifc export (FreeCAD exportIFC)", time.time() - t0)
    t0 = time.time()
    post = ifc_postpass(builder, path)
    builder.T.add("ifc post-pass (ifcopenshell)", time.time() - t0)
    return post


def ifc_postpass(builder, path):
    """Fix what FreeCAD's legacy exporter does not write (all verified against its source):
    - MultiMaterial -> IfcMaterialLayerSet + IfcMaterialLayerSetUsage (exporter: 'TODO support multimaterials')
    - window/door part materials -> IfcMaterialConstituentSet
    - IfcRelFillsElement door/window -> its IfcOpeningElement (exporter writes only IfcRelVoidsElement)
    - pure voids (host.Subtractions) get Pset_SemanticCAD / Pset_CADSource
    - OverallWidth/OverallHeight on IfcDoor/IfcWindow
    - de-duplicate IfcRelAggregates on element assemblies"""
    import ifcopenshell
    import ifcopenshell.api
    import ifcopenshell.guid
    import ifcopenshell.util.element as ue

    f = ifcopenshell.open(path)
    log = {}
    by_gid = {e.GlobalId: e for e in f.by_type("IfcRoot")}
    hist = (f.by_type("IfcOwnerHistory") or [None])[0]
    mat_by_name = {m.Name: m for m in f.by_type("IfcMaterial")}

    def ifc_mat(key):
        name = builder.mats[key].Label
        if name not in mat_by_name:
            mat_by_name[name] = ifcopenshell.api.run("material.add_material", f, name=name)
        return mat_by_name[name]

    # layer sets
    n = 0
    for name, r in builder.reg.items():
        if not r.get("layers"):
            continue
        el = by_gid.get(r["guid"])
        if el is None:
            continue
        if ue.get_material(el):
            continue
        ls = ifcopenshell.api.run("material.add_material_set", f, name=f"{r['id']} layers",
                                  set_type="IfcMaterialLayerSet")
        for l in r["layers"]:
            layer = ifcopenshell.api.run("material.add_layer", f, layer_set=ls, material=ifc_mat(l["material"]))
            layer.LayerThickness = l["thickness_m"]
            layer.Name = l.get("name", l["material"])
        ifcopenshell.api.run("material.assign_material", f, products=[el], type="IfcMaterialLayerSetUsage",
                             material=ls)
        usage = ue.get_material(el)
        if usage and usage.is_a("IfcMaterialLayerSetUsage"):
            usage.OffsetFromReferenceLine = -sum(l["thickness_m"] for l in r["layers"]) / 2
        n += 1
    log["layer_sets_added"] = n

    # constituent sets for doors/windows; fills; overall dims
    nc = nf = 0
    for name, r in builder.reg.items():
        if r.get("role") not in ("door", "window"):
            continue
        el = by_gid.get(r["guid"])
        if el is None:
            continue
        if not ue.get_material(el):
            cs = ifcopenshell.api.run("material.add_material_set", f, name=f"{r['id']} parts",
                                      set_type="IfcMaterialConstituentSet")
            for pname, mk in r["constituents"]:
                ifcopenshell.api.run("material.add_constituent", f, constituent_set=cs, material=ifc_mat(mk)).Name = pname
            ifcopenshell.api.run("material.assign_material", f, products=[el], type="IfcMaterialConstituentSet",
                                 material=cs)
            nc += 1
        w, h = r["overall"]
        # exporter copies Width/Height in mm into a metre-unit file (900.0 instead of 0.9): overwrite
        if hasattr(el, "OverallWidth"):
            el.OverallWidth = float(w)
        if hasattr(el, "OverallHeight"):
            el.OverallHeight = float(h)
        if not el.FillsVoids:
            hosts = [by_gid.get(builder.reg[h]["guid"]) for h in r["host_names"] if h in builder.reg]
            for hst in hosts:
                if hst is None:
                    continue
                ops = [rel.RelatedOpeningElement for rel in hst.HasOpenings
                       if rel.RelatedOpeningElement.Name == r["label"]]
                if ops:
                    f.createIfcRelFillsElement(ifcopenshell.guid.new(), hist, None, None, ops[0], el)
                    nf += 1
                    break
        for hst in [by_gid.get(builder.reg[h]["guid"]) for h in r["host_names"] if h in builder.reg]:
            for rel in (hst.HasOpenings if hst else []):
                o = rel.RelatedOpeningElement
                if o.Name == r["label"] and not ue.get_psets(o):
                    o.PredefinedType = "OPENING"
                    ps = ifcopenshell.api.run("pset.add_pset", f, product=o, name="Pset_SemanticCAD")
                    ifcopenshell.api.run("pset.edit_pset", f, pset=ps, properties={
                        "spec_id": r["id"], "role": "opening", "for_element": r["id"], "host": hst.Name})
    # curtain wall: exporter writes one IfcCurtainWall brep (mullions + panels fused in one rep) with the
    # single Material; replace by a constituent set Mullion/Panel so both materials survive
    for name, r in builder.reg.items():
        if not r.get("curtain"):
            continue
        el = by_gid.get(r["guid"])
        if el is None:
            continue
        if ue.get_material(el):
            ifcopenshell.api.run("material.unassign_material", f, products=[el])
        cs = ifcopenshell.api.run("material.add_material_set", f, name=f"{r['id']} parts",
                                  set_type="IfcMaterialConstituentSet")
        ifcopenshell.api.run("material.add_constituent", f, constituent_set=cs,
                             material=ifc_mat(r["curtain"]["mullion_material"])).Name = "Mullion"
        ifcopenshell.api.run("material.add_constituent", f, constituent_set=cs,
                             material=ifc_mat(r["curtain"]["panel_material"])).Name = "Panel"
        ifcopenshell.api.run("material.assign_material", f, products=[el], type="IfcMaterialConstituentSet",
                             material=cs)
        nc += 1
    log["constituent_sets_added"] = nc
    log["fills_added"] = nf

    # psets on pure voids (exporter creates the IfcOpeningElement with the subtraction's Label as Name)
    nv = 0
    for name, r in builder.reg.items():
        if r.get("role") != "void":
            continue
        for hname in r["hosts"]:
            hst = by_gid.get(builder.reg[hname]["guid"])
            if hst is None:
                continue
            for rel in hst.HasOpenings:
                o = rel.RelatedOpeningElement
                if o.Name == r["label"] and not ue.get_psets(o):
                    ps = ifcopenshell.api.run("pset.add_pset", f, product=o, name="Pset_CADSource")
                    ifcopenshell.api.run("pset.edit_pset", f, pset=ps,
                                         properties={k: (v if isinstance(v, (int, float, bool)) else str(v))
                                                     for k, v in r["props"].items()})
                    ps2 = ifcopenshell.api.run("pset.add_pset", f, product=o, name="Pset_SemanticCAD")
                    ifcopenshell.api.run("pset.edit_pset", f, pset=ps2,
                                         properties={"spec_id": r["id"], "role": "void",
                                                     **{k: (v if isinstance(v, (int, float, bool)) else str(v))
                                                        for k, v in r["void_extra"].items() if v is not None}})
                    o.PredefinedType = "OPENING"
                    nv += 1
    log["void_psets_added"] = nv

    # duplicate aggregation rels (same relating object + same related set)
    seen, dup = {}, 0
    for rel in list(f.by_type("IfcRelAggregates")):
        key = (rel.RelatingObject.id(), tuple(sorted(o.id() for o in rel.RelatedObjects)))
        if key in seen:
            f.remove(rel)
            dup += 1
        else:
            seen[key] = rel
    log["duplicate_aggregates_removed"] = dup

    # elements that are parts of an assembly must not also be directly contained in the storey
    nfix = 0
    for rel in f.by_type("IfcRelContainedInSpatialStructure"):
        keep = [e for e in rel.RelatedElements if not (getattr(e, "Decomposes", None) and
                                                        e.Decomposes[0].RelatingObject.is_a("IfcElement"))]
        if len(keep) != len(rel.RelatedElements):
            nfix += len(rel.RelatedElements) - len(keep)
            rel.RelatedElements = keep
    log["assembly_parts_uncontained"] = nfix

    # exporter re-uses an identical brep (e.g. the same door cut volume voiding two band walls) and
    # styles it once per use -> schema error "StyledByItem SET [0:1]": keep the first style
    ns = 0
    styled = {}
    for si in list(f.by_type("IfcStyledItem")):
        if si.Item is None:
            continue
        if si.Item.id() in styled:
            f.remove(si)
            ns += 1
        else:
            styled[si.Item.id()] = si
    log["duplicate_styles_removed"] = ns

    f.write(path)
    return log


# ----------------------------------------------------------------------------- mesh export (web viewer)

def registry_from_doc(doc):
    """Rebuild the mesh registry + materials from a saved/reopened FCStd (no spec needed)."""
    import Draft
    reg, mats = {}, {}
    for o in doc.Objects:
        if getattr(o, "SpecKey", ""):
            mats[o.SpecKey] = o
    key = {m.Name: k for k, m in mats.items()}
    for o in doc.Objects:
        t = Draft.getType(o)
        if not hasattr(o, "IfcType") or t in ("BuildingPart", "Site", "Floor", "Building"):
            continue
        props = dict(getattr(o, "IfcProperties", {}) or {})

        def pv(k, props=props):
            v = props.get(k + ";;Pset_SemanticCAD")
            return v.split(";;", 1)[1] if v else None

        m = getattr(o, "Material", None)
        r = {"id": pv("spec_id") or o.Label, "role": pv("role"), "ifc_type": o.IfcType,
             "guid": dict(o.IfcData).get("IfcUID"), "material": None, "part_materials": None,
             "parent": pv("parent_assembly"), "label": o.Label}
        if m is not None:
            if hasattr(m, "Materials"):
                r["part_materials"] = [key.get(x.Name, x.Label) for x in m.Materials]
            else:
                r["material"] = key.get(m.Name, m.Label)
        if t == "CurtainWall":
            r["curtain"] = {"mullion_material": pv("mullion_material"), "panel_material": pv("panel_material")}
        reg[o.Name] = r
    return reg, mats


def export_mesh(doc, path, registry=None, materials=None, tolerance_mm=2.0):
    """Tessellate every registered shape -> JSON for three.js.
    {units:'m', up:'Z', materials:{key:{color,transparency,ifc_name}},
     meshes:[{id, name, role, type(ifc), material, guid, positions[], indices[]}]}
    Multi-part objects (windows: frame/leaf/glass, layered walls, curtain walls: mullions/panels)
    are split per solid so each piece keeps its own material."""
    if not registry:
        registry, dm = registry_from_doc(doc)
        materials = materials or dm
    out = {"units": "m", "up": "Z", "materials": {}, "meshes": []}
    if materials:
        for k, m in materials.items():
            out["materials"][k] = {"color": list(m.Color[:3]), "transparency": m.Transparency, "ifc_name": m.Label}
    for name in list(registry.keys()):
        o = doc.getObject(name)
        if o is None or not hasattr(o, "Shape") or o.Shape.isNull() or not o.Shape.Solids:
            continue
        r = registry.get(name, {})
        if r.get("role") in ("void", "assembly"):
            continue  # voids have no body; assemblies are drawn through their children
        solids = o.Shape.Solids
        mats = [r.get("material")] * len(solids)
        pm = r.get("part_materials")
        if r.get("curtain"):
            nm = o.VerticalMullionNumber + o.HorizontalMullionNumber + o.DiagonalMullionNumber
            mats = [r["curtain"]["mullion_material"] if i < nm else r["curtain"]["panel_material"]
                    for i in range(len(solids))]
        elif pm and len(pm) == len(solids):
            mats = pm
        elif pm:
            mats = [pm[0]] * len(solids)
        cons = r.get("constituents")
        names = [c[0] for c in cons] if cons and len(cons) == len(solids) else [None] * len(solids)
        groups, gparts = {}, {}
        for s, m, nm_ in zip(solids, mats, names):
            groups.setdefault(m, []).append(s)
            if nm_:
                gparts.setdefault(m, set()).add(nm_)
        for m, sols in groups.items():
            pos, idx = [], []
            for s in sols:
                v, t = s.tessellate(tolerance_mm)
                base = len(pos) // 3
                for p in v:
                    pos += [round(p.x / MM, 4), round(p.y / MM, 4), round(p.z / MM, 4)]
                for a, b, c in t:
                    idx += [a + base, b + base, c + base]
            out["meshes"].append({"id": r.get("id", name), "name": o.Label, "role": r.get("role"),
                                  "parent": r.get("parent"),
                                  "type": "Ifc" + (r.get("ifc_type") or "").replace(" ", ""),
                                  "material": m, "part": "+".join(sorted(gparts.get(m, ()))) or None,
                                  "guid": r.get("guid"), "positions": pos, "indices": idx})
    with open(path, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))
    return {"meshes": len(out["meshes"]), "triangles": sum(len(m["indices"]) // 3 for m in out["meshes"])}


# ----------------------------------------------------------------------------- entry point

def build(spec, out_prefix, assembly_mode="buildingpart", write_ifc=True, write_mesh=True):
    """Build the spec. Writes <out_prefix>.FCStd, .ifc, .mesh.json, .report.json. Returns the report dict."""
    os.makedirs(os.path.dirname(os.path.abspath(out_prefix)), exist_ok=True)
    b = Builder(spec, out_prefix, assembly_mode=assembly_mode)
    b.run()
    rep = {"warnings": b.warnings}
    t0 = time.time()
    if os.path.exists(out_prefix + ".FCStd"):
        os.remove(out_prefix + ".FCStd")  # else saveAs leaves a .FCBak backup next to it
    b.doc.saveAs(out_prefix + ".FCStd")
    b.T.add("save FCStd", time.time() - t0)
    if write_ifc:
        rep["ifc_postpass"] = export_ifc(b, out_prefix + ".ifc")
    if write_mesh:
        t0 = time.time()
        rep["mesh"] = export_mesh(b.doc, out_prefix + ".mesh.json", b.reg, b.mats)
        b.T.add("mesh export", time.time() - t0)
    rep["timings"] = b.T.report()
    rep["objects"] = len(b.doc.Objects)
    rep["registry"] = {k: {kk: vv for kk, vv in v.items() if kk in ("id", "role", "guid", "ifc_type", "material",
                                                                    "part_materials", "curtain", "parent", "label")}
                       for k, v in b.reg.items()}
    rep["materials"] = {k: {"color": list(m.Color[:3]), "transparency": m.Transparency, "ifc_name": m.Label}
                        for k, m in b.mats.items()}
    with open(out_prefix + ".report.json", "w") as fh:
        json.dump(rep, fh, indent=1, default=str)
    rep["_builder"] = b
    return rep
