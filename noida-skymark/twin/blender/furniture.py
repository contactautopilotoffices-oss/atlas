"""Furniture, fixtures, plants, stairs, logo and feature walls. One object per CAD block instance; identical blocks
share one mesh (linked duplicates), so the GLB keeps them as instances. Positions and rotations are the CAD's.
Nothing is moved except the vertical snap onto the floor, and the placement check's nudges of 20 mm or less."""
import bpy, bmesh, math, os, random, re, fnmatch
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from twin_lib import MB, tok, slug, room_kind, in_poly, HERE

def T(x, y, z=0.0): return Matrix.Translation((x, y, z))
def RZ(a): return Matrix.Rotation(a, 4, "Z")
def RX(a): return Matrix.Rotation(a, 4, "X")

SEAT_MAP = {"task chair": "chair", "meeting chair": "chair", "staff chair": "chair", "director chair": "chair", "visitor chair": "lounge",
            "lounge armchair": "lounge", "lounge chair": "tub", "lounge tub chair": "tub", "cafe chair": "cafe", "cafe stool": "stool"}


class Furnisher:
    def __init__(self, ctx):
        self.c = ctx; self.L = ctx.L; self.S = ctx.S; self.R = ctx.reg; self.M = ctx.mats; self.F = ctx.S.get("furniture", {})
        SEAT_MAP.update(self.F.get("seat_kind_map", {}))      # opt-in: which model a CAD chair kind gets (RTP's stacking visitor chairs)
        self.rnd = random.Random(7)

    def mb(self): return MB(self.M)
    def f(self, key, default): return self.F.get(key, default)

    # -------------------------------------------------------------- desks
    def desks(self):
        seats = [s for s in self.L["seats"] if SEAT_MAP.get(s["kind"], "chair") == "chair"]
        screens = self.f("desk_screens", ["screen_white"]); rows = {}
        for i, d in enumerate(self.L["desks"]):
            cx, cy = d["c"]; a, w, dp, h = d["a"], round(d["w"], 2), round(d["d"], 2), d["h"]
            ws = "workstation" in d["kind"] or d.get("workstation")
            rot = a; scr = None
            if ws:
                nx, ny = -math.sin(a), math.cos(a); best, bd = None, 1.3
                for s in seats:
                    dd = math.hypot(s["x"] - cx, s["y"] - cy)
                    if dd < bd: bd, best = dd, s
                if best is not None and (best["x"] - cx) * nx + (best["y"] - cy) * ny < 0: rot = a + math.pi     # chair on the other long side
                scr = screens[i % len(screens)]
            var = (i * 7) % 3 if (ws and self.f("clutter", True)) else -1
            key = ("desk", w, dp, round(h, 3), scr, var)
            me = self.c.proto(key, lambda: self._desk(w, dp, h, scr, var))
            o = self.R.put("DESK", d.get("block", d["kind"]), me, T(cx, cy, 0) @ RZ(rot), props={"cad_kind": d["kind"]})
            if ws:
                rr = self.c.ras.room_at(cx, cy); rows.setdefault(rr["name"] if rr else "", []).append(d)
        self.rows = rows

    def desk_polys(self):
        """Desks the CAD draws as polygons (RTP's 120-degree workstations): the top follows the CAD outline exactly,
        a modesty screen runs along the outer (back) edges, one monitor faces the chair. Identical shapes share one mesh."""
        seats = [s for s in self.L["seats"] if SEAT_MAP.get(s["kind"], "chair") == "chair"]
        screens = self.f("desk_screens", ["screen_white"]); side = self.f("desk_side_screen", None)
        for i, d in enumerate(self.L.get("desk_polys", [])):
            P = [tuple(p) for p in d["poly"]]
            Q = []                         # merge nearly collinear edges, so two screens never overlap on one straight edge
            for k in range(len(P)):
                a0, b0, c0 = P[k - 1], P[k], P[(k + 1) % len(P)]
                cr = (b0[0] - a0[0]) * (c0[1] - b0[1]) - (b0[1] - a0[1]) * (c0[0] - b0[0])
                if abs(cr) > 1e-4 * math.dist(a0, b0) * math.dist(b0, c0) * 50: Q.append(b0)
            P = Q if len(Q) >= 3 else P; n = len(P); h = d.get("h", 0.75)
            cx = sum(p[0] for p in P) / n; cy = sum(p[1] for p in P) / n
            ch = min(seats, key=lambda s: math.hypot(s["x"] - cx, s["y"] - cy), default=None)
            # local frame: x along the direction from the chair to the desk centroid, so identical desks get identical keys
            ang = math.atan2(cy - ch["y"], cx - ch["x"]) if ch and math.hypot(ch["x"] - cx, ch["y"] - cy) < 1.5 else 0.0
            ca, sa = math.cos(-ang), math.sin(-ang)
            loc = [(round((x - cx) * ca - (y - cy) * sa, 2), round((x - cx) * sa + (y - cy) * ca, 2)) for x, y in P]
            scr = screens[i % len(screens)]; key = ("deskpoly", tuple(loc), round(h, 3), scr)
            def mk(loc=loc, h=h, scr=scr):
                m = self.mb(); top = self.f("desk_top", "oak"); fr = self.f("desk_frame", "white_metal")
                m.prism(loc, h - 0.025, h, top, bevel=0.004)
                # back edges: the edges farthest from the chair side (local -x is the chair): a 380 mm fabric screen on each
                for k in range(len(loc)):
                    (x0, y0), (x1, y1) = loc[k], loc[(k + 1) % len(loc)]; L_ = math.hypot(x1 - x0, y1 - y0)
                    if L_ < 0.45 or (x0 + x1) / 2 < 0.05: continue
                    a_ = math.atan2(y1 - y0, x1 - x0); nx_, ny_ = math.sin(a_), -math.cos(a_)
                    mx, my = (x0 + x1) / 2 - nx_ * 0.012, (y0 + y1) / 2 - ny_ * 0.012
                    m.box(L_ - 0.03, 0.024, 0.38, T(mx, my, h) @ RZ(a_), scr, 0.006)
                    m.box(0.024, 0.5, h - 0.03, T(mx, my, 0.0) @ RZ(a_ + math.pi / 2) @ T(0, 0, 0), side or fr, 0.004) if side else None
                # legs: two panel legs under the top, square to the chair direction
                for sy in (-1, 1): m.box(0.03, 0.42, h - 0.025, T(0.05, sy * 0.3, 0.0), fr, 0.004)
                Mm = T(0.1, 0, h)
                m.box(0.2, 0.17, 0.008, Mm @ RZ(math.pi / 2), "alu", 0.003); m.box(0.02, 0.11, 0.14, Mm @ T(0.03, 0, 0.008), "alu", 0.006)
                m.box(0.012, 0.56, 0.33, Mm @ T(-0.004, 0, 0.195), self.f("monitor", "screen_glass"), 0.004); m.box(0.014, 0.565, 0.345, Mm @ T(0.012, 0, 0.19), "plastic_black", 0.006)
                m.box(0.13, 0.42, 0.014, Mm @ T(-0.27, 0, 0), "plastic_black", 0.004)
                return m.build("workstation_poly")
            me = self.c.proto(key, mk)
            self.R.put("DESK", d.get("block", "deskpoly"), me, T(cx, cy, 0) @ RZ(ang), props={"cad_kind": d.get("kind", "workstation")})
            rr = self.c.ras.room_at(cx, cy)
            if rr: getattr(self, "rows", {}).setdefault(rr["name"], [])

    def _desk(self, w, dp, h, scr, var):
        m = self.mb(); top = self.f("desk_top", "oak"); fr = self.f("desk_frame", "white_metal")
        m.box(w, dp, 0.025, T(0, 0, h - 0.025), top, 0.004)
        for e in (-1, 1):
            for sy in (-1, 1): m.box(0.045, 0.045, h - 0.025 - 0.008, T(e * (w / 2 - 0.04), sy * (dp * 0.42 - 0.02), 0.008), fr, 0.006)
            m.box(0.045, dp * 0.84, 0.008, T(e * (w / 2 - 0.04), 0, 0.0), fr, 0.002)          # foot plate on the floor
            m.box(0.045, dp * 0.84 - 0.1, 0.045, T(e * (w / 2 - 0.04), 0, h - 0.025 - 0.045), fr, 0.006)
        m.box(w - 0.14, 0.04, 0.04, T(0, 0, h - 0.025 - 0.045), fr, 0.005)
        if scr is None: return m.build("desk")
        m.box(w - 0.06, 0.024, 0.38, T(0, -(dp / 2 - 0.012 - self.f("screen_inset", 0.0)), h), scr, 0.006)                   # desk screen at the back edge
        Mm = T(0, -(dp / 2 - 0.19), h)
        m.box(0.2, 0.17, 0.008, Mm, "alu", 0.003); m.box(0.11, 0.02, 0.14, Mm @ T(0, -0.03, 0.008), "alu", 0.006)
        m.box(0.56, 0.012, 0.33, Mm @ T(0, 0.004, 0.195), self.f("monitor", "screen_glass"), 0.004); m.box(0.565, 0.014, 0.345, Mm @ T(0, -0.008 - 0.004, 0.19), "plastic_black", 0.006)
        m.box(0.42, 0.13, 0.014, Mm @ T(0, 0.27, 0), "plastic_black", 0.004); m.box(0.06, 0.1, 0.02, Mm @ T(0.3, 0.27, 0), "plastic_black", 0.008)
        m.box(0.9 if w > 1.0 else 0.6, 0.12, 0.06, T(0, -(dp / 2 - 0.1), h - 0.025 - 0.13), fr, 0.004)   # cable tray under the top
        if var == 1:                     # a mug
            m.lathe(((0.0, 0.0), (0.034, 0.0), (0.039, 0.004), (0.0405, 0.09), (0.0375, 0.093), (0.0365, 0.012), (0.0, 0.010)), Mm @ T(-min(w / 2 - 0.12, 0.42), 0.18, 0), "mug_white", 20)
        elif var == 2:                   # a notebook and pen
            m.box(0.148, 0.21, 0.014, Mm @ T(-min(w / 2 - 0.12, 0.38), 0.24, 0) @ RZ(0.2), "cover_dark", 0.003)
            m.cyl(0.0042, 0.14, Mm @ T(-min(w / 2 - 0.12, 0.38) + 0.02, 0.24, 0.0182) @ RZ(0.5) @ T(0, -0.07, 0) @ RX(-math.pi / 2), "plastic_black", 8)
        return m.build("workstation")

    # -------------------------------------------------------------- linear lights over desk rows / capsule rings over desk banks
    def bank_lights(self):
        kind = self.f("desk_bank_light", None)
        if not kind: return
        H = self.c.H
        for room, ds in getattr(self, "rows", {}).items():
            if len(ds) < 4: continue
            along_y = sum(1 for d in ds if abs(math.sin(d["a"])) > 0.7) > len(ds) / 2
            key = (lambda d: d["c"][0]) if along_y else (lambda d: d["c"][1]); other = (lambda d: d["c"][1]) if along_y else (lambda d: d["c"][0])
            groups = []
            for d in sorted(ds, key=key):
                if groups and key(d) - key(groups[-1][-1]) < 0.9: groups[-1].append(d)
                else: groups.append([d])
            ceil = self.c.ceiling_z(room)
            for g in groups:
                if len(g) < 2: continue
                k = sum(key(d) for d in g) / len(g); lo = min(other(d) for d in g) - 0.3; hi = max(other(d) for d in g) + 0.3; ln = round(hi - lo, 1); mid = (lo + hi) / 2
                x, y, an = (k, mid, math.pi / 2) if along_y else (mid, k, 0.0)
                z = self.f("bank_light_z", 2.4); drop = round(ceil - z, 3)
                if kind == "capsule":           # a row of stadium rings, ~2.4 m apart, along the bank
                    nseg = max(1, round(ln / self.f("capsule_pitch", 2.4))); seg = ln / nseg; rl = round(max(1.0, seg - 0.6), 2)
                    me = self.c.proto(("bank", kind, rl, drop), lambda: self._bank(kind, rl, drop))
                    for kk in range(nseg):
                        u = -ln / 2 + (kk + 0.5) * seg
                        self.R.put("LIGHT", "capsulering", me, T(x + math.cos(an) * u, y + math.sin(an) * u, z) @ RZ(an), props={"assumed": 1, "lamp": "none"})
                else:
                    me = self.c.proto(("bank", kind, ln, drop), lambda: self._bank(kind, ln, drop))
                    self.R.put("LIGHT", f"{kind}bank", me, T(x, y, z) @ RZ(an), props={"assumed": 1, "lamp": "none"})

    def _bank(self, kind, ln, drop):
        m = self.mb()
        if kind == "capsule":
            R = 0.28; Ls = max(0.2, ln - 2 * R - 0.4); seg = 40; pts = []
            for i in range(seg):
                t = i / seg * 2 * math.pi; s = math.cos(t); c = math.sin(t)
                x = (Ls / 2 + R * s) if abs(s) > 1e-9 else 0; pts.append((Ls / 2 * (1 if s >= 0 else -1) + R * s, R * c))
            for i in range(seg):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % seg]; ln_ = math.hypot(x1 - x0, y1 - y0); an = math.atan2(y1 - y0, x1 - x0)
                M_ = T((x0 + x1) / 2, (y0 + y1) / 2, 0) @ RZ(an)
                m.box(ln_ + 0.004, 0.035, 0.04, M_, self.f("pendant_body", "black_metal")); m.box(ln_ + 0.004, 0.022, 0.004, M_ @ T(0, 0, -0.004), self.f("ring_led", self.f("pendant_led", "led_line")))
            for e in (-1, 1): m.rod((e * Ls / 2, 0, 0.05), (e * Ls / 2, 0, drop), 0.0015, 0.0015, "black_metal", None, 6)
        else:
            m.box(ln, 0.06, 0.07, Matrix(), self.f("pendant_body", "black_metal"), 0.006); m.box(ln - 0.04, 0.04, 0.004, T(0, 0, -0.004), self.f("pendant_led", "led_line"))
            for u in (-ln / 2 + 0.3, ln / 2 - 0.3): m.rod((u, 0, 0.07), (u, 0, drop), 0.0015, 0.0015, "black_metal", None, 6)
        return m.build("bank_light")

    # -------------------------------------------------------------- tables and rugs
    def tables(self):
        stools = [s for s in self.L["seats"] if SEAT_MAP.get(s["kind"]) == "stool"]; hd = self.L["heights"]["high_desk"]
        top = self.f("table_top", "oak"); base = self.f("table_base", "charcoal")
        for t in self.L["tables"]:
            h = t.get("h", 0.75)
            if "poly" in t and any(min(math.hypot(s["x"] - px, s["y"] - py) for px, py in t["poly"]) < 0.9 for s in stools): h = hd
            if "poly" in t and h < 0.5:
                xs = [p[0] for p in t["poly"]]; ys = [p[1] for p in t["poly"]]
                if (max(xs) - min(xs)) * (max(ys) - min(ys)) > 3.0 and any(min(xs) < s["x"] < max(xs) and min(ys) < s["y"] < max(ys) for s in self.L["seats"]):
                    m = self.mb(); cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
                    m.prism([(x - cx, y - cy) for x, y in t["poly"]], 0.0, 0.004, self.f("rug", "rug"), bevel=0.0015)
                    self.R.put("RUG", "rug", m.build("rug"), T(cx, cy, 0), props={"soft": 1}); continue
            if "circle" in t:
                x, y, r = t["circle"]; key = ("rtable", round(r, 2), round(h, 2))
                def mk(r=r, h=h):
                    m = self.mb(); m.lathe(((0.0, 0.0), (r - 0.006, 0.0), (r, 0.006), (r, 0.029), (r - 0.006, 0.035), (0.0, 0.035)), T(0, 0, h - 0.035), top, 48)
                    m.cyl(0.035, h - 0.035 - 0.015, T(0, 0, 0.015), "black_metal", 16); m.cyl(r * 0.55, 0.015, Matrix(), "black_metal", 32); return m.build("table")
                self.R.put("TABLE", "roundtable", self.c.proto(key, mk), T(x, y, 0)); continue
            xs = [p[0] for p in t["poly"]]; ys = [p[1] for p in t["poly"]]; cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
            loc = [(round(x - cx, 3), round(y - cy, 3)) for x, y in t["poly"]]; w = max(xs) - min(xs); d = max(ys) - min(ys)
            rd = self.F.get("reception_desk")
            if rd and w * d >= rd.get("min_area_m2", 1.0) and re.search(rd.get("room", "^reception$"), t.get("room", ""), re.I) and t is max([q for q in self.L["tables"] if q.get("room") == t.get("room") and "poly" in q], key=lambda q: (max(p[0] for p in q["poly"]) - min(p[0] for p in q["poly"])) * (max(p[1] for p in q["poly"]) - min(p[1] for p in q["poly"]))):
                # the reception desk: a faceted solid, its faces raked in at top and bottom (glossy cobalt in Paytm's brief)
                hh = rd.get("height", 1.05); m = self.mb(); import bmesh as _bm
                if rd.get("front_block"):
                    # opt-in (Altruist): a white body and top, a narrower royal-blue front block 50 mm proud of the visitor
                    # face, and a warm LED strip in a recessed plinth; the visitor face looks to the middle of the room
                    rr = next((q for q in self.c.ras.rooms if q["name"] == t.get("room")), None); bx = rr and rr.get("box")
                    rc = Vector(((bx[0] + bx[2]) / 2, (bx[1] + bx[3]) / 2)) if bx else Vector((cx, cy))
                    along_x = w >= d; L_, D_ = (w, d) if along_x else (d, w)
                    v = (1 if (rc.y - cy) >= 0 else -1) if along_x else (1 if (rc.x - cx) >= 0 else -1)     # world side of the visitor face
                    staff = [q for q in self.L["seats"] if "reception" in q["kind"] and math.hypot(q["x"] - cx, q["y"] - cy) < 2.0]
                    if staff:          # the receptionist's chair says which side is the staff side: the visitor face is the other one
                        q = staff[0]; v = -1 if ((q["y"] - cy) if along_x else (q["x"] - cx)) > 0 else 1
                    sgn = v if along_x else -v          # local +y turns to world -x when the desk runs north-south
                    R_ = Matrix.Rotation(0 if along_x else math.pi / 2, 4, "Z") @ Matrix.Scale(1, 4)      # local x along the desk, +y to the visitor side (sign below)
                    F_ = Matrix.Scale(sgn, 4, Vector((0, 1, 0)))
                    pl = rd.get("plinth", 0.08)
                    kd = rd.get("knee_frac", 0.3) * D_          # the staff side is open below the top (the receptionist's chair goes in there)
                    m.box(L_ - 0.1, D_ - kd - 0.1, pl, R_ @ F_ @ T(0, kd / 2, 0), rd.get("plinth_material", "black_paint"), 0.0)
                    m.box(L_, D_ - kd, hh - pl, R_ @ F_ @ T(0, kd / 2, pl), rd.get("body", "white_top"), 0.004)
                    m.box(L_ * rd.get("front_frac", 0.62), 0.05, hh - pl - 0.06, R_ @ F_ @ T(0, D_ / 2 + 0.025, pl + 0.03), rd.get("material", "royal_blue"), 0.004)
                    m.box(L_ - 0.12, 0.012, 0.012, R_ @ F_ @ T(0, D_ / 2 - 0.044, 0.03), rd.get("led", "led_warm"), 0.0)
                    m.box(L_ + 0.02, D_ + 0.02, 0.03, R_ @ F_ @ T(0, 0, hh), rd.get("top", "white_top"), 0.004)
                    self.R.put("TABLE", "receptiondesk", m.build("reception_desk"), T(cx, cy, 0), props={"room": t.get("room", "")}); continue
                def inset(poly, k):
                    return [(x * k, y * k) for x, y in poly]
                rings = [(inset(loc, 0.88), 0.0), (inset(loc, 1.0), 0.35), (inset(loc, 1.0), hh - 0.2), (inset(loc, 0.94), hh)]
                bm = _bm.new(); vs = [[bm.verts.new((x, y, z)) for x, y in ring] for ring, z in rings]
                for a_, b_ in zip(vs, vs[1:]):
                    for i in range(len(loc)): bm.faces.new((a_[i], a_[(i + 1) % len(loc)], b_[(i + 1) % len(loc)], b_[i]))
                bm.faces.new(vs[-1]); bm.faces.new(list(reversed(vs[0]))); _bm.ops.recalc_face_normals(bm, faces=bm.faces)
                m.add_bm(bm, rd.get("material", "cobalt_gloss")); bm.free()
                m.prism([(x * 0.96, y * 0.96) for x, y in loc], hh, hh + 0.03, rd.get("top", "white_top"), bevel=0.004)
                self.R.put("TABLE", "receptiondesk", m.build("reception_desk", normals=False), T(cx, cy, 0), props={"room": t.get("room", "")}); continue
            def mk(loc=loc, h=h, w=w, d=d):
                m = self.mb(); m.prism(loc, h - 0.04, h, top, bevel=0.006)
                if max(w, d) > 1.6: m.box(w * 0.72 if w > d else min(w, 0.9) * 0.45, d * 0.72 if d >= w else min(d, 0.9) * 0.45, h - 0.04, Matrix(), base, 0.008)
                else: m.cyl(0.04, h - 0.04 - 0.015, T(0, 0, 0.015), "black_metal", 16); m.cyl(min(w, d) * 0.3, 0.015, Matrix(), "black_metal", 32)
                return m.build("table")
            self.R.put("TABLE", t.get("block", "table"), self.c.proto(("table", tuple(loc), round(h, 3)), mk), T(cx, cy, 0), props={"room": t.get("room", "")})

    # -------------------------------------------------------------- seats
    def load_model(self, path, height, seat_band, override=None):
        if not os.path.isabs(path): path = os.path.normpath(os.path.join(HERE, path))
        before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=path)
        new = [o for o in bpy.data.objects if o not in before]; meshes = [o for o in new if o.type == "MESH"]
        m = MB(self.M); names = []
        bpy.context.view_layer.update()
        for o in meshes:
            me = o.data.copy(); me.transform(o.matrix_world)
            bm = bmesh.new(); bm.from_mesh(me)
            uvl = bm.loops.layers.uv.active
            parts = self.F.get("chair_parts") if (override and override == self.F.get("chair_material") and path.endswith("chair.glb")) else None
            for mi, mat in enumerate(o.data.materials):
                mname = override or f"model_{mat.name}"
                if not override and mname not in self.M.cache: self.M.cache[mname] = mat; mat.name = mname
                faces = [f for f in bm.faces if f.material_index == mi]
                if parts:         # opt-in: parts of a one-material chair by position (star base, castors, gas lift in chrome)
                    zs_ = [v.co.z for v in bm.verts]; zmin, zmax = min(zs_), max(zs_); H_ = max(1e-6, zmax - zmin)
                    xs_ = [v.co.x for v in bm.verts]; ys_ = [v.co.y for v in bm.verts]; cx_, cy_ = (min(xs_) + max(xs_)) / 2, (min(ys_) + max(ys_)) / 2
                    R_ = max(1e-6, (max(xs_) - min(xs_) + max(ys_) - min(ys_)) / 4)
                    groups = {}
                    for f in faces:          # rules in fractions of the chair's height and half-width
                        c_ = f.calc_center_median(); z_ = (c_.z - zmin) / H_; r_ = math.hypot(c_.x - cx_, c_.y - cy_) / R_
                        mt = next((pp["material"] for pp in parts if z_ < pp.get("z_below", 9) and r_ < pp.get("r_below", 9)), override)
                        groups.setdefault(mt, []).append(f)
                else: groups = {mname: faces}
                for mname, faces in groups.items():
                    if not faces: continue
                    vs = {}; verts = []; fl = []; uvs = []
                    for f in faces:
                        idx = []
                        for lp in f.loops:
                            verts.append(tuple(lp.vert.co)); idx.append(len(verts) - 1); uvs.append(tuple(lp[uvl].uv) if uvl else (0, 0))
                        fl.append(tuple(idx))
                    m.add(verts, fl, mname, None, True, uvs)
            bm.free(); bpy.data.meshes.remove(me)
        for o in new: bpy.data.objects.remove(o, do_unlink=True)
        me = m.build("model", normals=False)
        co = [v.co.copy() for v in me.vertices]
        lo = Vector((min(v.x for v in co), min(v.y for v in co), min(v.z for v in co))); hi = Vector((max(v.x for v in co), max(v.y for v in co), max(v.z for v in co)))
        k = height / (hi.z - lo.z); c = (lo + hi) / 2
        me.transform(Matrix.Scale(k, 4) @ Matrix.Translation((-c.x, -c.y, -lo.z)))
        top = [v.co for v in me.vertices if v.co.z > 0.86 * height]; seat = [v.co for v in me.vertices if seat_band[0] * height < v.co.z < seat_band[1] * height]
        bk = sum(top, Vector()) / len(top); st = sum(seat, Vector()) / len(seat)
        me.transform(Matrix.Rotation(-math.atan2(st.y - bk.y, st.x - bk.x), 4, "Z"))
        for p in me.polygons: p.use_smooth = True
        return me

    def fit(self, base, ln, dp):
        """The model's footprint scaled (the same in x and y, height kept) to the CAD block's footprint: the drawing says
        how much floor the chair takes; the model only says what it looks like."""
        me = base.copy(); xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]
        k = min(dp / (max(xs) - min(xs)), ln / (max(ys) - min(ys)), 1.25); k = max(k, 0.6)
        me.transform(Matrix.Diagonal((k, k, 1.0, 1.0))); me["fit_scale_xy"] = k; return me

    def shell_mesh(self, mat, seat_h, w, depth, back_h, lean=12.0, thick=0.012, m=None, M=None):
        nu, nv = 12, 26; R = 0.085; turn = math.radians(90 - lean); Ls = depth - R; La = R * turn; total = Ls + La + back_h
        pts = []; x, z, n_steps = depth / 2, seat_h, 400; prev = 0.0; k = 0
        for i in range(n_steps + 1):
            s_ = total * i / n_steps
            phi = math.pi if s_ < Ls else (math.pi - (s_ - Ls) / R if s_ < Ls + La else math.pi - turn)
            if i: x += math.cos(phi) * (s_ - prev); z += math.sin(phi) * (s_ - prev)
            prev = s_
            if i == round(n_steps * k / nv): pts.append((x, z, phi, s_ / total)); k += 1
        bm = bmesh.new(); grid = []
        for (x, z, phi, v) in pts:
            on_back = max(0.0, (v * total - Ls) / (La + back_h)); end = min(v, 1 - v) * total
            hw = w / 2 * (1 - 0.16 * on_back) * (0.8 + 0.2 * math.sin(min(1.0, end / 0.07) * math.pi / 2)); nx, nz = math.sin(phi), -math.cos(phi)
            dip = -0.012 * math.sin(min(1.0, v * total / 0.1) * math.pi / 2) + 0.012; row = []
            for i in range(nu + 1):
                u = -1 + 2 * i / nu; cup = (0.03 * u * u + 0.02 * u ** 4) * (1 + 0.8 * on_back)
                row.append(bm.verts.new((x + nx * cup, u * hw, z + nz * cup - dip)))
            grid.append(row)
        for a_, b_ in zip(grid, grid[1:]):
            for i in range(nu): bm.faces.new((a_[i], a_[i + 1], b_[i + 1], b_[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thick)
        m.add_bm(bm, mat, M, smooth=True); bm.free()

    def seats(self):
        F = self.F; H = self.L["heights"]
        chair = self.c.proto("chair_model", lambda: self.load_model(F.get("chair_model", "../../volt/blender/models/chair.glb"), F.get("chair_height", 1.02), (0.40, 0.52), F.get("chair_material")))
        lounge = self.c.proto("lounge_model", lambda: self.load_model(F.get("lounge_model", "../../volt/blender/models/lounge.glb"), F.get("lounge_height", 0.82), (0.30, 0.50), F.get("lounge_material")))
        cafe_mats = F.get("cafe", ["plastic_orange", "plastic_grey"]); sofas = F.get("sofa", ["sofa_grey", "sofa_teal"]); n_cafe = 0
        smap = dict(SEAT_MAP); smap.update(F.get("seat_map", {}))
        for s in self.L["seats"]:
            k = s["kind"]; typ = "sofa" if "sofa" in k else smap.get(k, "chair")
            for rule in F.get("seat_kind_by_room", []):      # opt-in: a chair kind gets another model in some rooms (reception benches)
                if re.search(rule["room"], s.get("room") or "", re.I) and (not rule.get("kind") or rule["kind"] == k): typ = rule["type"]
            a = s["face"] + self.rnd.uniform(-0.06, 0.06)      # a few degrees of turn, never a move
            if typ == "beam": a = s["face"]                    # beam seating is one rigid row
            M0 = T(s["x"], s["y"], 0) @ RZ(a)
            if typ in ("chair", "lounge"):
                base = chair if typ == "chair" else lounge; me = base
                if self.F.get("fit_models_to_cad", True) and s.get("len") and s.get("dep"):
                    me = self.c.proto(("fit", typ, round(s["len"], 2), round(s["dep"], 2)), lambda base=base, s=s: self.fit(base, s["len"], s["dep"]))
                self.R.put("SEAT", s.get("block", k), me, M0, props={"cad_kind": k, "seat_id": s.get("id", "")})
            elif typ == "cafe":
                n_cafe += 1; mat = cafe_mats[n_cafe % len(cafe_mats)]
                def mk(mat=mat):
                    m = self.mb(); self.shell_mesh(mat, 0.45, 0.46, 0.43, 0.34, m=m, M=Matrix())
                    for sx in (-1, 1):
                        for sy in (-1, 1): m.rod((sx * 0.13 - 0.02, sy * 0.13, 0.445), (sx * 0.21 - 0.02, sy * 0.2, 0.0), 0.017, 0.011, F.get("cafe_legs", "oak"))
                    return m.build("cafe_chair")
                self.R.put("SEAT", s.get("block", k), self.c.proto(("cafe", mat), mk), M0, props={"cad_kind": k})
            elif typ == "beam":          # airport-style beam seating: upholstered seat and back on a black steel beam, one unit per CAD seat
                mat = F.get("beam_fabric", "fabric_grey"); wb = F.get("beam_width", 0.56)
                def mk(mat=mat, wb=wb):
                    m = self.mb(); fr = "black_metal"; cw = wb - 0.06
                    m.box(0.43, cw, 0.10, T(0.0, 0, 0.37), mat, 0.04)                                                      # seat cushion
                    m.box(0.09, cw, 0.46, T(-0.22, 0, 0.45) @ Matrix.Rotation(math.radians(-10), 4, "Y"), mat, 0.04)       # back cushion
                    m.box(0.42, cw - 0.04, 0.02, T(0.0, 0, 0.345), fr, 0.004)                                               # seat pan
                    for e in (-1, 1):
                        m.box(0.32, 0.022, 0.022, T(0.0, e * (wb / 2 - 0.016), 0.63), "chrome", 0.006)                    # arm
                        m.rod((0.13, e * (wb / 2 - 0.016), 0.63), (0.13, e * (wb / 2 - 0.016), 0.33), 0.009, 0.009, "chrome", None, 10)
                    m.box(0.06, wb - 0.02, 0.05, T(-0.03, 0, 0.29), fr, 0.006)                                              # beam
                    m.cyl(0.022, 0.29, T(-0.03, 0, 0.0), "chrome", 14); m.box(0.36, 0.05, 0.012, T(-0.03, 0, 0.0), fr, 0.004)
                    return m.build("beam_seat")
                self.R.put("SEAT", s.get("block", k), self.c.proto(("beam", mat, wb), mk), M0, props={"cad_kind": k, "seat_id": s.get("id", "")})
            elif typ == "stool":
                def mk():
                    m = self.mb(); self.shell_mesh(F.get("stool", "planter_white"), 0.74, 0.4, 0.37, 0.13, m=m, M=Matrix())
                    for sx in (-1, 1):
                        for sy in (-1, 1): m.rod((sx * 0.1 - 0.02, sy * 0.1, 0.735), (sx * 0.2 - 0.02, sy * 0.19, 0.0), 0.016, 0.011, F.get("cafe_legs", "oak"))
                    for sy in (-1, 1): m.rod((-0.17, sy * 0.145, 0.27), (0.13, sy * 0.145, 0.27), 0.007, 0.007, "black_metal", None, 8)
                    return m.build("stool")
                self.R.put("SEAT", s.get("block", k), self.c.proto("stool", mk), M0, props={"cad_kind": k})
            elif typ == "tub":
                mat = F.get("tub", "sofa_teal")
                def mk(mat=mat):
                    m = self.mb(); m.lathe(((0.0, 0.03), (0.27, 0.03), (0.3, 0.045), (0.325, 0.2), (0.33, 0.37), (0.32, 0.41), (0.29, 0.435), (0.0, 0.44)), Matrix(), mat, 40)
                    m.cyl(0.25, 0.03, Matrix(), "black_metal", 32)
                    rr = 0.06; rm = 0.3; sec = [(-rr, 0.3)] + [(-rr * math.cos(math.radians(q)), 0.72 - rr + rr * math.sin(math.radians(q))) for q in range(0, 181, 30)] + [(rr, 0.3)]
                    bm = bmesh.new(); rings = []; seg = 24; ha = math.radians(100)
                    for i in range(seg + 1):
                        t = i / seg; ang = math.pi - ha + 2 * ha * t; e = min(t, 1 - t) * seg; kk = min(1.0, 0.45 + 0.55 * math.sin(min(1.0, e / 3) * math.pi / 2))
                        rings.append([bm.verts.new(((rm + dx * kk) * math.cos(ang), (rm + dx * kk) * math.sin(ang), 0.3 + (z - 0.3) * (0.75 + 0.25 * kk))) for dx, z in sec])
                    mm = len(sec)
                    for a_, b_ in zip(rings, rings[1:]):
                        for j in range(mm): bm.faces.new((a_[j], a_[(j + 1) % mm], b_[(j + 1) % mm], b_[j]))
                    bm.faces.new(rings[0]); bm.faces.new(rings[-1]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); m.add_bm(bm, mat, None, True); bm.free()
                    return m.build("tub")
                self.R.put("SEAT", s.get("block", k), self.c.proto(("tub", mat), mk), M0, props={"cad_kind": k})
            else:      # sofa: length and depth from the CAD block
                n = len(s.get("ids", [1])); ln = round(max(1.3, s.get("len", 1.6)), 2); dp = round(min(0.95, max(0.75, s.get("dep", 0.8))), 2)
                mat = sofas[0] if n > 2 else sofas[min(1, len(sofas) - 1)]
                def mk(ln=ln, dp=dp, n=n, mat=mat):
                    m = self.mb(); m.box(dp, ln, 0.24, T(0, 0, 0.16), mat, 0.06); m.box(0.2, ln, 0.44, T(-dp / 2 + 0.1, 0, 0.3), mat, 0.07)
                    for e in (-1, 1): m.box(dp, 0.18, 0.3, T(0, e * (ln / 2 - 0.09), 0.3), mat, 0.06)
                    cw = (ln - 0.4) / n
                    for i in range(n): m.box(dp - 0.26, cw - 0.02, 0.13, T(0.08, -ln / 2 + 0.2 + (i + 0.5) * cw, 0.4), mat, 0.05)
                    for sx in (-1, 1):
                        for sy in (-1, 1): m.cyl(0.02, 0.16, T(sx * (dp / 2 - 0.08), sy * (ln / 2 - 0.1), 0), "black_metal", 8)
                    return m.build("sofa")
                self.R.put("SEAT", s.get("block", k), self.c.proto(("sofa", ln, dp, n, mat), mk), M0, props={"cad_kind": k, "seat_id": s.get("id", "")})

    # -------------------------------------------------------------- planters and plants (thin leaves, light passes through)
    def leafy(self, m, x, y, z, n, spread, hgt, PR):
        NS, NB = 3, 9
        for i in range(n):
            age = (i + PR.random()) / n; ang = PR.uniform(0, 6.283); r0 = spread * (0.1 + 0.6 * age) * PR.uniform(0.4, 1.0)
            pos = Vector((x + math.cos(ang) * r0, y + math.sin(ang) * r0, z))
            lp = hgt * PR.uniform(0.12, 0.6) * (0.8 + 0.3 * age); lb = hgt * PR.uniform(0.46, 0.72) * (0.7 + 0.3 * min(1.0, age * 2.5)); wb = lb * PR.uniform(0.26, 0.37) / 2
            th0 = math.radians(3 + 46 * age * PR.uniform(0.5, 1.2)); bend = math.radians(PR.uniform(22, 70)) * (0.45 + 0.75 * age); fold = math.radians(PR.uniform(12, 34))
            dx, dy = math.cos(ang), math.sin(ang); side0 = Vector((-dy, dx, 0)); total = lp + lb; prev_t = None; s_prev = 0.0; V = []; UV = []
            for j in range(NS + NB + 1):
                if j <= NS: lt = 0.0; s_ = lp * j / NS; w = 0.0022
                else: lt = (j - NS) / NB; s_ = lp + lb * lt; w = max(0.0022 * (1 - lt), wb * math.sin(math.pi * lt ** 0.72) ** 0.85)
                th = th0 + bend * (s_ / total) ** 1.6; tan = Vector((dx * math.sin(th), dy * math.sin(th), math.cos(th)))
                if prev_t is not None: pos = pos + (prev_t + tan) * 0.5 * (s_ - s_prev)
                prev_t, s_prev = tan, s_; up = tan.cross(side0).normalized()
                for u in (-1.0, 0.0, 1.0):
                    V.append(tuple(pos + side0 * (w * u * math.cos(fold)) + up * (w * abs(u) * math.sin(fold)))); UV.append((u * 0.5 + 0.5, lt))
            F_ = []
            for j in range(NS + NB):
                for c in range(2): a_ = j * 3 + c; F_.append((a_, a_ + 1, a_ + 4, a_ + 3))
            m.add(V, F_, self.f("leaf", "leaf"), None, True, UV)

    def plants(self):
        PH = self.L["heights"]["planter"]; PR = random.Random(23)
        pl = self.f("planter", "planter_white"); pan = self.f("planter_panel", "oak")
        for p in self.L["planters"]:
            x, y = p["c"]; a, w, d = p.get("a", 0.0), round(p["w"], 2), round(p["d"], 2); var = len(self.R.count) % 2
            def mk(w=w, d=d):
                m = self.mb(); m.box(w, d, PH - 0.04, T(0, 0, 0.0), pl, 0.008); m.box(w * 0.5, d + 0.01, PH - 0.12, T(0, 0, 0.04), pan, 0.004)
                rim = 0.03
                for s_ in (-1, 1):
                    m.box(w + 0.02, rim, 0.075, T(0, s_ * (d / 2 + 0.01 - rim / 2), PH - 0.04), "planter_top", 0.006)
                    m.box(rim, d + 0.02 - 2 * rim - 0.004, 0.075, T(s_ * (w / 2 + 0.01 - rim / 2), 0, PH - 0.04), "planter_top", 0.006)
                m.box(w - 0.03, d - 0.03, 0.04, T(0, 0, PH - 0.045), "soil")
                nc = max(4, round(w / 0.21)); R_ = random.Random(int(w * 1000))
                for i in range(nc):
                    u = -w / 2 + w * (i + 0.5) / nc + R_.uniform(-0.03, 0.03)
                    self.leafy(m, u, R_.uniform(-0.05, 0.05), PH - 0.005, R_.randint(20, 26), min(d, 0.3) * 0.5, R_.uniform(0.36, 0.46), R_)
                return m.build("planter")
            self.R.put("PLANTER", "planter", self.c.proto(("planter", w, d), mk), T(x, y, 0) @ RZ(a))
        for i, p in enumerate(self.L["plants"]):
            if p.get("in_box"): continue
            var = i % 3
            def mk(var=var):
                m = self.mb(); R_ = random.Random(100 + var)
                m.lathe(((0.0, 0.0), (0.125, 0.0), (0.132, 0.006), (0.168, 0.425), (0.172, 0.44), (0.166, 0.446), (0.156, 0.44), (0.153, 0.415), (0.0, 0.415)), Matrix(), self.f("pot", "pot"), 32)
                m.cyl(0.152, 0.01, T(0, 0, 0.405), "soil", 24); self.leafy(m, 0, 0, 0.415, R_.randint(26, 32), 0.1, R_.uniform(0.6, 0.72), R_)
                return m.build("pot_plant")
            self.R.put("PLANT", "potplant", self.c.proto(("pot", var), mk), T(p["x"], p["y"], 0) @ RZ(i * 1.3))

    # -------------------------------------------------------------- ceiling light fixtures (from the CAD's ceiling plan, or assumed)
    def light_fixtures(self):
        Lst = self.S.get("light", {}); F = self.F
        dropped = []
        if self.S.get("drop_unceiled_lights"):      # opt-in: an assumed light with no ceiling surface right above it is left out
            dg = bpy.context.evaluated_depsgraph_get(); sc = bpy.context.scene; keep = []
            for l in self.c.shell.lights:
                if l.get("assumed") and l["ceiling"] in ("grid", "plain", "cove"):
                    hit = sc.ray_cast(dg, Vector((l["x"], l["y"], l["z"] - 0.05)), Vector((0, 0, 1)), distance=0.1)
                    if not hit[0]: dropped.append([round(l["x"], 2), round(l["y"], 2), l["room"]]); continue
                keep.append(l)
            self.c.shell.lights = keep; self.c.log("assumed_lights_dropped_no_ceiling", dropped)
            keep, dup = [], 0                    # and no two lights on one spot (two rooms' assumed grids meeting at a shared edge)
            for l in self.c.shell.lights:
                if any(abs(l["x"] - q["x"]) < 0.6 and abs(l["y"] - q["y"]) < 0.6 and abs(l["z"] - q["z"]) < 0.05 for q in keep): dup += 1; continue
                keep.append(l)
            self.c.shell.lights = keep; self.c.log("duplicate_lights_dropped", dup)
        for l in self.c.shell.lights:
            typ = l["ceiling"]; k = l["kind"]; x, y, z = l["x"], l["y"], l["z"]; ceil = self.c.ceiling_z(l["room"])
            if typ == "open" or (typ == "baffle" and z < ceil - 0.02):
                style = self.c.shell.ceiling_spec({"name": l["room"]})[0].get("pendant", "cylinder"); drop = round(max(0.05, ceil - z), 3)
                if style == "capsule":
                    me = self.c.proto(("capsule1", drop), lambda: self._bank("capsule", 1.2, drop))
                    self.R.put("LIGHT", "capsulering", me, T(x, y, z), props={"assumed": int(l["assumed"]), "lamp": "none", "room": l["room"]})
                else:
                    def mk(drop=drop):
                        m = self.mb(); m.cyl(0.08, 0.28, Matrix(), F.get("pendant_body", "black_metal"), 24); m.cyl(0.07, 0.004, T(0, 0, 0.002), "led_spot_soft", 24)
                        m.rod((0, 0, 0.28), (0, 0, drop), 0.0015, 0.0015, "black_metal", None, 6); return m.build("pendant")
                    self.R.put("LIGHT", "cylinderpendant", self.c.proto(("pend", drop), mk), T(x, y, z), props={"assumed": int(l["assumed"]), "lamp": "spot", "lamp_z": 0.0, "room": l["room"]})
            elif k == "panel600" and typ in ("grid", "plain"):
                def mk():
                    m = self.mb(); m.box(0.57, 0.57, 0.008, T(0, 0, -0.008), "led_panel", 0.0); return m.build("panel600")
                self.R.put("LIGHT", "panel600", self.c.proto("panel600", mk), T(x, y, z) @ RZ(l.get("rot", 0.0)), props={"assumed": int(l["assumed"]), "lamp": "none", "room": l["room"]})
            else:
                def mk():
                    m = self.mb(); m.lathe(((0.056, 0.0), (0.060, -0.005), (0.078, -0.005), (0.082, 0.0)), Matrix(), "white_metal", 24)
                    m.cyl(0.056, 0.008, T(0, 0, -0.008), "led_spot", 20); return m.build("downlight")
                self.R.put("LIGHT", "downlight", self.c.proto("downlight", mk), T(x, y, z), props={"assumed": int(l["assumed"]), "lamp": "spot", "lamp_z": -0.01, "room": l["room"]})
        for (r, spec, (cx, cy), zb, along_x) in self.c.extra_pendants:     # one slim linear pendant over a cove raft (meeting / board rooms)
            ln = spec.get("pendant_length", 1.8); drop = 0.6; z = zb - drop
            if self.c.shell.ceiling_of.get(r["name"], {}).get("type") in ("open", "baffle"): drop = round(self.c.Hs - 0.003 - z, 3)     # hung from the soffit
            me = self.c.proto(("bank", "linear", ln, drop), lambda: self._bank("linear", ln, drop))
            self.R.put("LIGHT", "linearpendant", me, T(cx, cy, z) @ RZ(0 if along_x else math.pi / 2), props={"assumed": 1, "lamp": "none", "room": r["name"]})

    # -------------------------------------------------------------- washroom fixtures and stairs
    def fixtures(self):
        sh = self.c.shell
        def wall_behind(x, y):
            best = None
            for k_ in range(16):
                a_ = k_ * math.pi / 8; dx, dy = math.cos(a_), math.sin(a_)
                for i in range(1, 30):
                    if sh.in_wall(x + dx * i * 0.04, y + dy * i * 0.04):
                        if best is None or i < best[0]: best = (i, a_)
                        break
            return (best[1], best[0] * 0.04) if best else (0.0, 0.6)
        for f in self.L["fixtures"]:
            x, y = f["c"]; a_, dw = wall_behind(x, y); rz = a_ - math.pi / 2; dw = round(dw, 2)
            def mk(kind=f["kind"], dw=dw):
                m = self.mb(); P = lambda t: T(0, t, 0)
                if kind == "wc":
                    m.box(0.38, 0.16, 0.40, P(dw - 0.09) @ T(0, 0, 0.40), "ceramic", 0.03); m.box(0.36, 0.52, 0.39, P(dw - 0.44), "ceramic", 0.08); m.box(0.37, 0.47, 0.025, P(dw - 0.46) @ T(0, 0, 0.39), "ceramic", 0.012)
                elif kind == "urinal":
                    m.box(0.36, 0.30, 0.64, P(dw - 0.15) @ T(0, 0, 0.42), "ceramic", 0.08)
                else: m.box(0.05, 0.05, 0.13, P(dw - 0.03) @ T(0, 0, 0.5), "alu", 0.01)
                return m.build(kind)
            self.R.put("FIXTURE", f["kind"], self.c.proto(("fix", f["kind"], dw), mk), T(x, y, 0) @ RZ(rz), props={"wall_mounted": int(f["kind"] not in ("wc",))})
        st = self.L.get("stairs")
        if st and st.get("steps"):
            m = self.mb()
            for i, (sx0, sy0, sx1, sy1) in enumerate(st["steps"]):
                m.box(sx1 - sx0, sy1 - sy0, min((i + 1) * st.get("riser", 0.156), self.c.Hs - 0.05), T((sx0 + sx1) / 2, (sy0 + sy1) / 2, 0), self.S.get("walls", {}).get("stair", "stone"), 0.006)
            self.R.put("STAIR", "stairflight", m.build("stair"), props={"static": 1})

    # -------------------------------------------------------------- walls: finding a flat wall in a room for a logo / feature finish
    def find_wall(self, r, side="auto", z=1.6, avoid=()):
        dg = bpy.context.evaluated_depsgraph_get(); sc = bpy.context.scene
        x0, y0, x1, y1 = r["box"]; c = Vector(((x0 + x1) / 2, (y0 + y1) / 2, z))
        dirs = {"E": 0, "N": 90, "W": 180, "S": 270}
        cand = [dirs[side]] if side in dirs else list(range(0, 360, 30 if side == "door" else 45))
        if side in ("table_end", "facing"):      # opt-in: the end wall of the room's biggest table, or the wall its chairs face (the front of a training room)
            ang = None
            if side == "table_end":
                tb = [q for q in self.L["tables"] if q.get("room") == r["name"] and "poly" in q]
                if tb:
                    q = max(tb, key=lambda q: (max(p[0] for p in q["poly"]) - min(p[0] for p in q["poly"])) * (max(p[1] for p in q["poly"]) - min(p[1] for p in q["poly"])))
                    w_ = max(p[0] for p in q["poly"]) - min(p[0] for p in q["poly"]); d_ = max(p[1] for p in q["poly"]) - min(p[1] for p in q["poly"])
                    ang = 0 if w_ >= d_ else 90; cand = [ang, ang + 180]
            else:
                fs = [s_["face"] for s_ in self.L["seats"] if s_.get("room") == r["name"]]
                if fs:
                    cx_ = sum(math.cos(f) for f in fs); cy_ = sum(math.sin(f) for f in fs)
                    if math.hypot(cx_, cy_) > 0.5 * len(fs): cand = [round(math.degrees(math.atan2(cy_, cx_)) / 5) * 5]
            if side == "table_end" and ang is None: cand = list(range(0, 360, 45))
        origins = [c]
        if side == "door":       # the wall you face as you come in: looked for from 1 m inside each door of the room
            origins = []
            for d in self.L["doors"]:
                op = d.get("_opening")
                if not op: continue
                for sgn in (-1, 1):
                    q = Vector((op[0] - math.sin(op[2]) * sgn, op[1] + math.cos(op[2]) * sgn, z))
                    if self.c.ras.room_at(q.x, q.y) is r: origins.append(q)
            origins = origins or [c]
        best = None
        for c, deg in [(o_, d_) for o_ in origins for d_ in cand]:
            d = Vector((math.cos(math.radians(deg)), math.sin(math.radians(deg)), 0))
            hit, loc, nrm, _, ob, _ = sc.ray_cast(dg, c, d, distance=30)
            if not hit or ob.get("twin_layer") not in ("WALL", "COLUMN", "SKIRTING") or nrm.dot(-d) < 0.85: continue
            qb = loc - d * 0.2
            if self.c.ras.room_at(qb.x, qb.y) is not r: continue          # a wall of this room, not one seen through a door
            n2 = Vector((nrm.x, nrm.y, 0)).normalized(); t = Vector((-n2.y, n2.x, 0))
            ext = []
            for s in (-1, 1):
                e = 0.0
                while e < 12:
                    p = loc + n2 * 0.3 + t * s * (e + 0.1)
                    h2, l2, nn, _, o2, _ = sc.ray_cast(dg, p, -n2, distance=0.6)
                    if not h2 or abs((l2 - loc).dot(n2)) > 0.02 or o2.get("twin_layer") not in ("WALL",): break
                    e += 0.1
                ext.append(e)
            width = ext[0] + ext[1]; score = width - 0.1 * (loc - c).length if side != "door" else min(width, 4.0) + 0.5 * min((loc - c).length, 6.0)
            mid = loc + t * (ext[1] - ext[0]) / 2
            if any((Vector((mid.x, mid.y, 0)) - Vector((a.x, a.y, 0))).length < 1.5 for a in avoid): continue     # already used by another finish
            fr = sc.ray_cast(dg, mid + n2 * 0.03, n2, distance=1.5)
            if fr[0]: score -= 20                   # something (a column, a partition) stands right in front of this wall
            if best is None or score > best[0]: best = (score, loc, n2, t, ext)
        if not best: return None
        _, loc, n2, t, ext = best; mid = loc + t * (ext[1] - ext[0]) / 2
        return {"point": Vector((mid.x, mid.y, 0)), "normal": n2, "tangent": t, "width": ext[0] + ext[1]}

    def logo(self):
        lgs = self.S.get("logo")
        if not lgs: return
        for lg in (lgs if isinstance(lgs, list) else [lgs]): self._logo(lg)

    def _logo(self, lg):
        r = next((r for r in self.c.ras.rooms if r.get("box") and re.search(lg.get("room", "Reception"), r["name"], re.I)), None)
        if not r: print("logo: no room matches", lg.get("room")); return
        fwall = self.c.feature_wall_of.get(r["name"]) if lg.get("wall") == "feature" else None
        w = fwall or self.find_wall(r, lg.get("wall", "auto") if lg.get("wall") != "feature" else "auto", lg.get("z", 1.6))
        if not w: print("logo: no flat wall found in", r["name"]); return
        n, t = w["normal"], w["tangent"]; ang = math.atan2(t.y, t.x); hgt = lg.get("height", 0.45); z = lg.get("z", 1.6)
        img = lg.get("image"); p = img and (img if os.path.isabs(img) else os.path.join(HERE, img))
        if p and os.path.exists(p):
            im = bpy.data.images.load(p, check_existing=True); aspect = im.size[0] / max(1, im.size[1]); wd = min(hgt * aspect, w["width"] - 0.4)
            self.M.S.setdefault("logo_image", {"kind": "image", "image": p, "emit": lg.get("emit", 0.0)})
            m = self.mb(); m.add([(-wd / 2, 0, -hgt / 2), (wd / 2, 0, -hgt / 2), (wd / 2, 0, hgt / 2), (-wd / 2, 0, hgt / 2)], [(0, 1, 2, 3)], "logo_image", None, False, [(0, 0), (1, 0), (1, 1), (0, 1)])
            me = m.build("logo")
            mode = "image"
        elif lg.get("depth"):
            # built letters (opt-in): text extruded to `depth`, an optional square mark tile on the left, and a thin
            # emissive halo plate behind both (backlit letters: the halo is what lights the wall round them)
            me, wd = self._logo_built(lg, hgt); mode = "built"
        else:
            cu = bpy.data.curves.new("logo_text", "FONT"); cu.body = lg.get("text", self.c.tenant.upper()); cu.size = hgt; cu.extrude = 0.006; cu.align_x = "CENTER"; cu.align_y = "CENTER"
            tmp = bpy.data.objects.new("tmp", cu); bpy.context.scene.collection.objects.link(tmp); bpy.context.view_layer.update()
            me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())); bpy.data.objects.remove(tmp); bpy.data.curves.remove(cu)
            me.transform(Matrix.Rotation(math.pi / 2, 4, "X")); me.materials.clear(); me.materials.append(self.M.get(lg.get("material", "logo")))
            mode = "text"
        stand = {"text": 0.012, "image": 0.005, "built": lg.get("standoff", 0.03) + lg.get("depth", 0.04) / 2}[mode]
        M_ = Matrix.Translation(w["point"] + n * (stand + (w.get("thickness", 0.0) if fwall else 0.0)) + Vector((0, 0, z))) @ RZ(ang)
        lo = self.R.put("LOGO", "tenantlogo", me, M_, props={"room": r["name"], "mode": mode})
        if lg.get("downlights"):         # two downlights grazing the logo wall (as in the photo): fixtures in the ceiling 0.45 m off the wall
            H_ = self.c.ceiling_z(r["name"])
            def mkd():
                m2 = self.mb(); m2.lathe(((0.056, 0.0), (0.060, -0.005), (0.078, -0.005), (0.082, 0.0)), Matrix(), "white_metal", 24)
                m2.cyl(0.056, 0.008, T(0, 0, -0.008), "led_spot", 20); return m2.build("downlight")
            for u in (-1, 1):
                q = w["point"] + n * 0.45 + t * u * lg.get("downlight_spread", 0.9)
                self.R.put("LIGHT", "downlight", self.c.proto("downlight", mkd), T(q.x, q.y, H_), props={"assumed": 1, "lamp": "spot", "lamp_z": -0.01, "room": r["name"], "aim_wall": 1})
        dg = bpy.context.evaluated_depsgraph_get(); pt = M_.translation + n * 0.05
        blocked = [d_ for d_ in (-0.6, 0.0, 0.6) if bpy.context.scene.ray_cast(dg, pt + t * d_, n, distance=2.0)[0]]
        lo["front_clear_2m"] = not blocked
        if blocked: print(f"logo in {r['name']}: something stands within 2 m in front of it (offsets {blocked})", flush=True)
        self.c.meta["log"].setdefault("logo", []).append({"room": r["name"], "mode": mode, "at": [round(v, 2) for v in w["point"]][:2]})

    def _svg_word(self, svg, lg, dep, mark):
        """The client's own wordmark: an SVG (traced outline) imported as curves, scaled so mark + gap + word span
        lg['width'] (the mark tile is as tall as the word), extruded to `dep`, centred on z = 0 in the x-y plane
        (turned upright by the caller). Returns (mesh, word height)."""
        import addon_utils
        try: addon_utils.enable("io_curve_svg", default_set=False)
        except Exception: pass
        before = set(bpy.data.objects); bpy.ops.import_curve.svg(filepath=svg)
        objs = [o for o in bpy.data.objects if o not in before and o.type == "CURVE"]
        pts = [o.matrix_world @ p.co for o in objs for sp in o.data.splines for p in sp.bezier_points]
        x0, x1 = min(p.x for p in pts), max(p.x for p in pts); y0, y1 = min(p.y for p in pts), max(p.y for p in pts)
        aspect = (x1 - x0) / max(1e-9, y1 - y0); H = lg.get("width", 2.3) / ((1.05 + 0.18 if mark else 0.0) + aspect); sc_ = H / (y1 - y0)
        tm = bpy.data.meshes.new("logo_word"); import bmesh as _bm; bm = _bm.new()
        for o in objs:
            o.data.transform(Matrix.Scale(sc_, 4) @ o.matrix_world @ Matrix.Translation((0, 0, 0))); o.matrix_world = Matrix()
            for sp in o.data.splines:          # the importer stacks paths a little apart in depth: put every point on one plane
                for bp in sp.bezier_points: bp.co.z = 0.0; bp.handle_left.z = 0.0; bp.handle_right.z = 0.0
                for pp in sp.points: pp.co.z = 0.0
            o.data.dimensions = "2D"; o.data.fill_mode = "BOTH"; o.data.extrude = dep / 2; o.data.resolution_u = 6
        bpy.context.view_layer.update(); dg = bpy.context.evaluated_depsgraph_get()
        for o in objs:
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); bm.from_mesh(me); bpy.data.meshes.remove(me)
        cx, cy = (x0 + x1) / 2 * sc_, (y0 + y1) / 2 * sc_
        _bm.ops.translate(bm, vec=(-cx, -cy, 0), verts=bm.verts); bm.to_mesh(tm); bm.free()
        cols = {c for o in objs for c in o.users_collection}
        for o in objs: d_ = o.data; bpy.data.objects.remove(o); bpy.data.curves.remove(d_)
        for c in cols:
            if c != bpy.context.scene.collection and not c.objects: bpy.data.collections.remove(c)
        print(f"logo: wordmark from {os.path.basename(svg)}, {aspect:.2f}:1, word height {H:.3f} m, {len(tm.polygons)} faces", flush=True)
        return tm, H

    def _logo_built(self, lg, hgt):
        dep = lg.get("depth", 0.04); m = self.mb(); parts = []; mark = lg.get("mark")
        svg = lg.get("word_svg"); svg = svg and (svg if os.path.isabs(svg) else os.path.join(HERE, svg))
        if svg and os.path.exists(svg):
            tm, hgt = self._svg_word(svg, lg, dep, mark)
        else:
            cu = bpy.data.curves.new("logo_text", "FONT"); cu.body = lg.get("text", self.c.tenant); cu.size = hgt * 1.3; cu.extrude = dep / 2; cu.align_x = "LEFT"; cu.align_y = "CENTER"
            if lg.get("font") and os.path.exists(lg["font"]): cu.font = bpy.data.fonts.load(lg["font"], check_existing=True)
            try: cu.body_format[0].use_bold = True
            except Exception: pass
            tmp = bpy.data.objects.new("tmp", cu); bpy.context.scene.collection.objects.link(tmp); bpy.context.view_layer.update()
            tm = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get())); bpy.data.objects.remove(tmp); bpy.data.curves.remove(cu)
        xs = [v.co.x for v in tm.vertices] or [0, 1]; tw = max(xs) - min(xs)
        ms = hgt * 1.05 if mark else 0.0; gap = hgt * 0.18 if mark else 0.0; total = ms + gap + tw; x0 = -total / 2
        tm.transform(Matrix.Translation((x0 + ms + gap - min(xs), 0, 0)))
        tm.transform(Matrix.Rotation(math.pi / 2, 4, "X"))          # letters stand in the x-z plane, depth along -y (out of the wall)
        tm.materials.clear(); tm.materials.append(self.M.get(lg.get("material", "logo")))
        import bmesh as _bm
        bm = _bm.new(); bm.from_mesh(tm); tm2 = tm.copy(); bpy.data.meshes.remove(tm)
        m.add_bm(bm, lg.get("material", "logo")); bm.free()
        if mark:                       # the square "A" tile: a 40 mm deep block with a white chevron raised 3 mm on its face
            mx = x0 + ms / 2
            m.box(ms, dep, ms, T(mx, 0, -ms / 2), mark.get("material", "logo_mark"), 0.003)
            for s_ in (-1, 1):          # an upward chevron (the 'A' of the mark), white, inside the tile
                L_ = ms * 0.66; a_ = -0.40 * s_; bw = ms * 0.12          # box() grows up from its base: pivot at the foot, feet apart, tops meet
                m.box(bw, 0.004, L_, T(mx + s_ * ms * 0.25, -dep / 2 - 0.005, -ms * 0.31) @ Matrix.Rotation(a_, 4, "Y"), mark.get("chevron", "logo"), 0.0)
        hl = lg.get("halo")
        if hl:                         # backlight: an emissive copy of the letters 4 mm behind their back face, hidden by them;
            bm2 = _bm.new(); bm2.from_mesh(tm2)          # it lights the wall round each letter (the halo), it is never seen itself
            _bm.ops.scale(bm2, vec=(1.0, 0.1, 1.0), verts=bm2.verts)
            _bm.ops.translate(bm2, vec=(0, dep / 2 + 0.006, 0), verts=bm2.verts)
            m.add_bm(bm2, hl.get("material", "logo_halo")); bm2.free()
        try: bpy.data.meshes.remove(tm2)
        except Exception: pass
        return m.build("logo_built"), total

    def feature_walls(self):
        for fw in self.S.get("feature_walls", []):
            rooms = [r for r in self.c.ras.rooms if r.get("box") and ((fw.get("room") and re.search(fw["room"], r["name"], re.I)) or (fw.get("kind") and room_kind(self.S, r["name"]) == fw["kind"]))]
            for ri, r in enumerate(rooms[:fw.get("max_rooms", 99)]):
                w = self.find_wall(r, fw.get("side", "auto"), avoid=self.c.used_walls.setdefault(r["name"], []))
                if not w and fw.get("fallback_auto") and fw.get("side", "auto") != "auto":       # opt-in: no wall on that side, take the best other one
                    w = self.find_wall(r, "auto", avoid=self.c.used_walls[r["name"]]); print(f"feature wall in {r['name']}: no {fw.get('side')} wall, used the best other wall" if w else f"feature wall in {r['name']}: no flat wall", flush=True)
                if w: self.c.used_walls[r["name"]].append(w["point"])
                if not w: continue
                n, t = w["normal"], w["tangent"]; ang = math.atan2(t.y, t.x); wd = min(w["width"] - 0.1, fw.get("width", 99)); z0, z1 = fw.get("z0", 0.1), min(fw.get("z1", 2.6), self.c.ceiling_z(r["name"]) - 0.02)
                typ = fw.get("type", "panel"); mat = fw.get("material", "accent"); m = self.mb(); hh = z1 - z0
                if isinstance(mat, list): mat = mat[ri % len(mat)]          # e.g. teal in one meeting room, violet in the next
                if typ == "fluted":
                    p = fw.get("pitch", 0.045); k = int(wd / p)
                    for i in range(k): m.cyl(p * 0.48, hh, T(-wd / 2 + (i + 0.5) * p, p * 0.2, z0), mat, 10)
                    m.box(wd, 0.012, hh, T(0, 0.006, z0), mat)
                    if fw.get("lights_every"):           # slim vertical wall lights set into the flutes
                        k_ = max(1, int(wd / fw["lights_every"]))
                        for i in range(k_):
                            u = -wd / 2 + (i + 0.5) * wd / k_; m.box(0.03, 0.025, hh * 0.8, T(u, p * 0.55, z0 + hh * 0.1), "black_metal", 0.003)
                            m.box(0.012, 0.004, hh * 0.78, T(u, p * 0.55 + 0.0145, z0 + hh * 0.11), fw.get("light_material", "led_line"))
                elif typ == "triangles":
                    cols = fw.get("materials", [mat]); s = fw.get("cell", 0.35); rows = int(hh / (s * 0.866)); cn = int(wd / s) * 2
                    R_ = random.Random(3)
                    for j in range(rows):
                        for i in range(cn):
                            u = -wd / 2 + i * s / 2; zz = z0 + j * s * 0.866; up = (i + j) % 2 == 0
                            vs = [(u, 0.012, zz), (u + s, 0.012, zz), (u + s / 2, 0.012, zz + s * 0.866)] if up else [(u, 0.012, zz + s * 0.866), (u + s / 2, 0.012, zz), (u + s, 0.012, zz + s * 0.866)]
                            if u + s > wd / 2: continue
                            m.add(vs, [(0, 2, 1) if up else (0, 1, 2)], R_.choice(cols))
                    m.box(wd, 0.01, hh, T(0, 0.005, z0), fw.get("backing", "charcoal"))
                elif typ == "lockers":
                    k = int(wd / 0.45)
                    for i in range(k): m.box(0.44, 0.5, hh, T(-wd / 2 + (i + 0.5) * 0.45, 0.25 + 0.002, z0), mat, 0.004); m.box(0.02, 0.03, 0.15, T(-wd / 2 + (i + 0.5) * 0.45 + 0.17, 0.515, z0 + hh * 0.5), "alu", 0.004)
                elif typ == "wave":
                    nu, nv = 60, 24; V = []; Fc = []
                    for j in range(nv + 1):
                        for i in range(nu + 1):
                            u = -wd / 2 + wd * i / nu; zz = z0 + hh * j / nv; V.append((u, 0.03 + 0.025 * math.sin(u * 5 + zz * 2.5) * math.sin(zz * 3.1), zz))
                    for j in range(nv):
                        for i in range(nu): a_ = j * (nu + 1) + i; Fc.append((a_, a_ + 1, a_ + nu + 2, a_ + nu + 1))
                    m.add(V, Fc, mat, None, True); m.box(wd, 0.03, 0.02, T(0, 0.04, z1 - 0.01), fw.get("cove", "cove_led"))
                elif typ == "screen":      # opt-in: a wall display with a low credenza under it, and an optional whiteboard beside it
                    sw, sh_ = fw.get("screen_w", 1.65), fw.get("screen_h", 0.95)
                    span = sw + (2.2 if fw.get("whiteboard") and wd > sw + 2.2 else 0.0); ops = [d_["_opening"] for d_ in self.L["doors"] if d_.get("_opening")]
                    ok_at = None; pref = 0.0
                    tb = [q for q in self.L["tables"] if q.get("room") == r["name"] and "poly" in q]
                    if tb:                 # centred on the room's main table (as a screen is hung), not on the wall segment
                        q = max(tb, key=lambda q: (max(p_[0] for p_ in q["poly"]) - min(p_[0] for p_ in q["poly"])) * (max(p_[1] for p_ in q["poly"]) - min(p_[1] for p_ in q["poly"])))
                        tc = Vector((sum(p_[0] for p_ in q["poly"]) / len(q["poly"]), sum(p_[1] for p_ in q["poly"]) / len(q["poly"]), 0))
                        pref = (tc - Vector((w["point"].x, w["point"].y, 0))).dot(t)
                    for off in [pref + d_ for d_ in (0.0, 0.25, -0.25, 0.5, -0.5, 1.0, -1.0, 1.5, -1.5)]:
                        if abs(off) + span / 2 > wd / 2: continue
                        q = w["point"] + t * off
                        if all(math.hypot(op[0] - q.x, op[1] - q.y) > span / 2 + 0.6 for op in ops): ok_at = off; break
                    if ok_at is None: print(f"screen in {r['name']}: every spot on that wall is within 1 m of a door; left out", flush=True); continue
                    if abs(ok_at - pref) > 0.05: print(f"screen in {r['name']}: {ok_at - pref:+.2f} m off the table axis to clear a door", flush=True)
                    w = dict(w, point=w["point"] + t * ok_at)
                    m.box(sw + 0.02, 0.04, sh_ + 0.02, T(0, 0.022, fw.get("screen_z", 1.0)), "black_metal", 0.004)
                    m.box(sw, 0.004, sh_, T(0, 0.044, fw.get("screen_z", 1.0) + 0.01), fw.get("screen_material", "tv_screen"), 0.0)
                    if fw.get("credenza", True) and wd > 1.6:
                        cw = min(fw.get("credenza_w", 1.8), wd - 0.2); cd_ = fw.get("credenza_d", 0.4)
                        m.box(cw, cd_, 0.6, T(0, cd_ / 2 + 0.003, 0.0), fw.get("credenza_material", "white_top"), 0.004)
                        m.box(cw + 0.02, cd_ + 0.01, 0.025, T(0, cd_ / 2 + 0.008, 0.6), fw.get("credenza_top", "oak"), 0.003)
                    if fw.get("whiteboard") and wd > sw + 2.2:
                        u = sw / 2 + 0.25 + 0.9
                        m.box(1.82, 0.025, 1.22, T(u, 0.0145, 0.9), "white_metal", 0.003); m.box(1.78, 0.004, 1.18, T(u, 0.029, 0.92), fw.get("board_material", "whiteboard"), 0.0)
                else:
                    m.box(wd, fw.get("thickness", 0.018), hh, T(0, fw.get("thickness", 0.018) / 2 + 0.002, z0), mat, 0.003)
                tt = -t        # right-handed frame: x along the wall, y out of the wall into the room
                M_ = Matrix.Translation(w["point"]) @ Matrix(((tt.x, n.x, 0, 0), (tt.y, n.y, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))
                self.R.put("FEATURE", f"{typ}_{r['slug']}", m.build("feature"), M_, props={"room": r["name"], "wall_mounted": 1})
                (self.c.feature_wall_of.__setitem__ if fw.get("logo_wall") else self.c.feature_wall_of.setdefault)(r["name"], dict(w, thickness=fw.get("thickness", 0.018) + 0.002 if typ == "panel" else 0.06, width=wd))

    # -------------------------------------------------------------- snap every floor-standing object onto what is under it
    def support_bvh(self):
        verts, polys = [], []
        for o in bpy.context.scene.objects:
            if o.type != "MESH" or o.get("twin_layer") not in ("FLOOR", "RUG", "STAIR"): continue
            mw = o.matrix_world; k = len(verts)
            verts += [mw @ v.co for v in o.data.vertices]; polys += [[k + i for i in p.vertices] for p in o.data.polygons]
        return BVHTree.FromPolygons(verts, polys), {o.name: o.get("twin_layer") for o in bpy.context.scene.objects}

    def snap(self):
        bvh, _ = self.support_bvh(); moved = []; nosupport = []
        foot_cache = {}
        for o in bpy.context.scene.objects:
            if o.type != "MESH" or o.get("twin_layer") not in ("DESK", "SEAT", "TABLE", "PLANTER", "PLANT", "FIXTURE") or o.get("wall_mounted"): continue
            me = o.data
            if me.name not in foot_cache:
                zs = [v.co.z for v in me.vertices]; zmin = min(zs); low = [v.co.copy() for v in me.vertices if v.co.z < zmin + 0.004]
                step = max(1, len(low) // 16); foot_cache[me.name] = (zmin, low[::step][:24])
            zmin, low = foot_cache[me.name]; mw = o.matrix_world; sup = []
            for p in low:
                w = mw @ p; hit = bvh.ray_cast(Vector((w.x, w.y, w.z + 0.3)), Vector((0, 0, -1)), 1.0)
                if hit[0] is not None: sup.append(hit[0].z)
            if not sup: nosupport.append(o.name); continue
            target = max(sup) - zmin
            dz = target - o.location.z
            if abs(dz) > 1e-5: o.location.z = target; moved.append([o.name, round(dz, 4)])
        self.c.log("snap", {"raised_or_lowered": len(moved), "no_support_below": nosupport})
        print(f"snap: {len(moved)} objects set onto the surface below them; {len(nosupport)} have nothing under them (left as placed, reported)", flush=True)
