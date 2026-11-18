"""Shell of the floor: slab, floor finishes, walls (with glass openings), skirting, columns, soffit slab, facade
closure, atrium, glass partitions and facade windows, doors (leaf + frame + header), ceilings per room, ceiling
fixtures. Furniture is in furniture.py. All positions come from the layout (CAD); heights and finishes from the style.
"""
import bpy, math, random, json
import numpy as np
from mathutils import Vector, Matrix
from twin_lib import MB, Registry, in_poly, pip, room_kind, lin, slug, tok

def T(x, y, z=0.0): return Matrix.Translation((x, y, z))
def RZ(a): return Matrix.Rotation(a, 4, "Z")
def seg_frame(x0, y0, x1, y1): return math.hypot(x1 - x0, y1 - y0), math.atan2(y1 - y0, x1 - x0), (x0 + x1) / 2, (y0 + y1) / 2


class Shell:
    def __init__(self, ctx):
        self.c = ctx; self.L = ctx.L; self.S = ctx.S; self.R = ctx.reg; self.M = ctx.mats; self.ras = ctx.ras
        self.H = ctx.H; self.Hs = ctx.Hs; self.log = ctx.log
        self.WBOX = [(min(p[0] for p in w["outer"]), min(p[1] for p in w["outer"]), max(p[0] for p in w["outer"]), max(p[1] for p in w["outer"])) for w in self.L["walls"]]
        self.portals = []; self.ceiling_of = {}

    def mb(self): return MB(self.M)
    def mat(self, group, key, default):
        return self.S.get(group, {}).get(key, default)

    def in_wall(self, x, y):
        for w, b in zip(self.L["walls"], self.WBOX):
            if b[0] <= x <= b[2] and b[1] <= y <= b[3] and in_poly(x, y, w["outer"]) and not any(in_poly(x, y, h) for h in w["holes"]): return True
        return False

    def closed_floor_labels(self):
        """Opt-in (floor_close_m): leftover 'Circulation' cells in a notch or pocket of a room (where the drawing's room
        outline steps round a furniture block) take that room's finish, so a reception tile floor has no carpet patches.
        Morphological closing of each room's cells by floor_close_m; only Circulation cells change."""
        ras = self.ras; lab = ras.label.copy(); circ = len(ras.rooms) - 1; n = max(1, int(round(self.S["floor_close_m"] / ras.res)))
        def shift_or(m, it, grow):
            for _ in range(it):
                o = m.copy()
                if grow:
                    o[1:, :] |= m[:-1, :]; o[:-1, :] |= m[1:, :]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]
                else:
                    o[1:, :] &= m[:-1, :]; o[:-1, :] &= m[1:, :]; o[:, 1:] &= m[:, :-1]; o[:, :-1] &= m[:, 1:]
                m = o
            return m
        changed = 0
        for k in range(circ):
            ii, jj = np.nonzero(ras.label == k)
            if not len(ii): continue
            i0, i1, j0, j1 = max(0, ii.min() - n - 1), min(ras.ny, ii.max() + n + 2), max(0, jj.min() - n - 1), min(ras.nx, jj.max() + n + 2)
            sub = ras.label[i0:i1, j0:j1] == k
            cl = shift_or(shift_or(sub, n, True), n, False)
            fill = cl & (lab[i0:i1, j0:j1] == circ); changed += int(fill.sum()); lab[i0:i1, j0:j1][fill] = k
        self.c.meta["log"]["floor_close_cells"] = changed; print(f"floors: {changed * ras.res ** 2:.1f} m2 of leftover circulation cells given their room's finish", flush=True)
        return lab

    # -------------------------------------------------------------- slab and floor finishes
    def slab_and_floors(self):
        L, ras = self.L, self.ras
        m = self.mb()
        for f in L["floor"]:
            holes = list(f["holes"]) + ([L["atrium"]] if L.get("atrium") else [])
            m.prism(f["outer"], -0.30, -0.02, self.mat("walls", "slab", "concrete"), holes=[h for h in holes if self._inside(h, f["outer"])])
        self.R.put("SLAB", "floorslab", m.build("slab_below"))
        # finishes: the raster gives each cell one room, so neighbouring finishes never overlap and nothing is layered
        floors = self.S.get("floors", {}); aisle = self.S.get("aisle", {})
        amask = self.c.aisle_mask() if aisle else None
        lab = self.closed_floor_labels() if self.S.get("floor_close_m") else ras.label
        exact = []
        if self.S.get("floor_exact_rooms"):      # opt-in: a finish zone drawn as a free polygon (the octagonal reception tile) is built from
            import re as _re                     # its exact outline 3 mm proud; the cells under it take the surrounding finish
            lab = lab.copy() if lab is ras.label else lab
            for k, r in enumerate(ras.rooms):
                if not r.get("poly") or not _re.search(self.S["floor_exact_rooms"], r["name"], _re.I): continue
                cells = lab == k
                if not cells.any(): continue
                ring = np.zeros_like(cells); ring[1:, :] |= cells[:-1, :]; ring[:-1, :] |= cells[1:, :]; ring[:, 1:] |= cells[:, :-1]; ring[:, :-1] |= cells[:, 1:]
                nb = lab[ring & ~cells]; nb = nb[nb >= 0]
                if not len(nb): continue
                lab[cells] = np.bincount(nb).argmax(); exact.append((k, r))
        for k, r in enumerate(ras.rooms):
            cells = lab == k
            if not cells.any(): continue
            kind = room_kind(self.S, r["name"], r.get("kind")); mat = self.S.get("floor_by_kind", {}).get(kind) or floors.get(r.get("floor", "carpet"), "carpet")
            parts = [(mat, cells)]
            if amask is not None and kind in aisle.get("kinds", []):
                a = cells & amask
                if a.sum() * ras.res ** 2 > 1.0: parts = [(mat, cells & ~a), (aisle["material"], a)]
            if len(parts) == 2 and aisle.get("led"):
                a = parts[1][1]; g = np.zeros_like(a); g[1:, :] |= ~a[:-1, :]; g[:-1, :] |= ~a[1:, :]; g[:, 1:] |= ~a[:, :-1]; g[:, :-1] |= ~a[:, 1:]
                edge = a & g & cells
                lm_ = self.mb()
                for (x0, y0, x1, y1) in ras.rects(edge): lm_.quad(x0, y0, x1, y1, 0.003, aisle["led"])     # 3 mm proud of the carpet
                if not lm_.empty(): self.R.put("FLOOR", f"ledprofile_{r['slug']}", lm_.build("led_profile", normals=False), props={"room": r["name"]})
            for pm, pc in parts:
                mm = self.mb()
                self.surface(mm, pc, 0.0, pm)
                if not mm.empty(): self.R.put("FLOOR", f"{tok(pm)}_{r['slug']}", mm.build(f"floor_{r['slug']}"), props={"room": r["name"], "static": 1})
        for k, r in exact:
            kind = room_kind(self.S, r["name"], r.get("kind")); mat = self.S.get("floor_by_kind", {}).get(kind) or floors.get(r.get("floor", "carpet"), "carpet")
            mm = self.mb(); mm.prism(r["poly"], 0.0, self.S.get("floor_exact_lift", 0.003), mat)
            self.R.put("FLOOR", f"{tok(mat)}_{r['slug']}", mm.build(f"floor_{r['slug']}"), props={"room": r["name"], "static": 1, "exact_outline": 1})
        if exact: print(f"floors: {len(exact)} finish zone(s) built from their exact outline: {[r['name'] for _, r in exact]}", flush=True)
        # the floor above: its underside is the soffit, seen wherever a room has an open ceiling
        m = self.mb()
        for f in L["floor"]:
            holes = ([L["atrium"]] if L.get("atrium") else []) + list(f["holes"])
            m.prism(f["outer"], self.Hs, self.Hs + 0.3, self.mat("walls", "soffit", "soffit_paint"), holes=[h for h in holes if self._inside(h, f["outer"])])
        self.R.put("SLAB", "floorslab_above", m.build("slab_above"), props={"static": 1})

    def _inside(self, h, outer):
        return all(in_poly(x, y, outer) for x, y in h[:4])

    # -------------------------------------------------------------- glass runs (same reading of the CAD as volt_render.py)
    def glass_runs(self):
        L = self.L; SILL, HEAD = self.S.get("facade", {}).get("sill", 0.9), self.S.get("facade", {}).get("head", 2.25)
        GB, GT = 0.1, self.S.get("glass", {}).get("top", 2.4)
        def strip_at(px, py, nx, ny, reach):
            step = 0.0125; k = int(reach / step); hits = [self.in_wall(px + nx * i * step, py + ny * i * step) for i in range(-k, k + 1)]; runs = []; i = 0
            while i < len(hits):
                if hits[i]:
                    j = i
                    while j + 1 < len(hits) and hits[j + 1]: j += 1
                    if 0 < i and j < len(hits) - 1 and (j - i) * step <= 0.2: runs.append(((i - k) * step - step, (j - k) * step + step))
                    i = j + 1
                else: i += 1
            return min(runs, key=lambda r: min(abs(r[0]), abs(r[1]))) if runs else None
        def same_partition(a, b):
            la, ana, _, _ = seg_frame(*a[:4]); lb, anb, _, _ = seg_frame(*b[:4]); ux, uy = math.cos(ana), math.sin(ana)
            if abs(math.sin(ana - anb)) > 0.05 or abs(-(b[0] - a[0]) * uy + (b[1] - a[1]) * ux) > 0.12: return False
            sb = sorted(((b[0] - a[0]) * ux + (b[1] - a[1]) * uy, (b[2] - a[0]) * ux + (b[3] - a[1]) * uy))
            return min(la, sb[1]) - max(0.0, sb[0]) > 0.6 * min(la, lb)
        fxs = [p[0] for f in L["floor"] for p in f["outer"]]; fys = [p[1] for f in L["floor"] for p in f["outer"]]; MID = ((min(fxs) + max(fxs)) / 2, (min(fys) + max(fys)) / 2)
        facade_layers = set(self.S.get("facade", {}).get("layers", ["AR-WINDOW"]))
        runs, cuts, kept = [], [], []
        for g in L["glass"]:
            x0, y0, x1, y1, layer = g[:5]; ln, an, cx, cy = seg_frame(x0, y0, x1, y1)
            if ln < 0.2: continue
            facade = layer in facade_layers or (self.S.get("facade", {}).get("by_position", True) and self._near_edge((x0 + x1) / 2, (y0 + y1) / 2, 1.2))
            n = max(1, round(ln / 1.2))
            if any(same_partition(k_, g) for k_ in kept): continue
            kept.append(g); ux, uy = math.cos(an), math.sin(an); nx, ny = -uy, ux; strips = []
            for i in range(n):
                st = None
                for f in (0.5, 0.25, 0.75):
                    u = ln * (i + f) / n; st = strip_at(x0 + ux * u, y0 + uy * u, nx, ny, 0.45 if facade else 0.17)
                    if st: break
                strips.append(st)
            i = 0
            while i < n:
                j = i
                while j + 1 < n and (strips[j + 1] is None) == (strips[i] is None): j += 1
                st = None
                if strips[i] is not None:
                    ss = strips[i:j + 1]; st = (sorted(a for a, b in ss)[len(ss) // 2], sorted(b for a, b in ss)[len(ss) // 2])
                u0, u1 = ln * i / n, ln * (j + 1) / n; mx, my = x0 + ux * (u0 + u1) / 2, y0 + uy * (u0 + u1) / 2
                runs.append({"facade": facade, "layer": layer, "n": j + 1 - i, "len": u1 - u0, "an": an, "c": (mx, my), "strip": st,
                             "in": 1.0 if (MID[0] - mx) * nx + (MID[1] - my) * ny > 0 else -1.0})
                if st: cuts.append((mx, my, an, u1 - u0, (st[0] + st[1]) / 2, st[1] - st[0], SILL if facade else GB, HEAD if facade else GT))
                i = j + 1
        self.runs, self.cuts = runs, cuts; self.SILL, self.HEAD, self.GB, self.GT = SILL, HEAD, GB, GT

    def surface(self, m, cells, z, mat, down=False, step=4):
        """A flat surface over a cell mask as ONE connected mesh (shared vertices, 10 cm grid, coplanar faces dissolved
        afterwards in _weld): one UV island per region for the lightmap, no slivers, no T-junction cracks."""
        ras = self.ras; sub = cells[step // 2::step, step // 2::step]; d = ras.res * step
        idx = {}; V = []; F = []
        def vid(i, j):
            if (i, j) not in idx: idx[(i, j)] = len(V); V.append((ras.x0 + j * d, ras.y0 + i * d, z))
            return idx[(i, j)]
        for (i, j) in np.argwhere(sub):
            q = (vid(i, j), vid(i, j + 1), vid(i + 1, j + 1), vid(i + 1, j))
            F.append(tuple(reversed(q)) if down else q)
        if F: m.add(V, F, mat); m.weld = True

    def _near_edge(self, x, y, tol):
        for f in self.L["floor"]:
            r = f["outer"]
            for i in range(len(r)):
                (ax, ay), (bx, by) = r[i], r[(i + 1) % len(r)]; dx, dy = bx - ax, by - ay; l2 = dx * dx + dy * dy
                if l2 < 1e-9: continue
                t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / l2))
                if math.hypot(ax + t * dx - x, ay + t * dy - y) < tol: return True
        return False

    def closures(self):
        """Wall closures from the CAD pipeline: non-virtual ones from the tenant config (lift doorways, ducts) and the
        automatic ones at the facade (gaps between facade bays). Automatic interior ones (toilet entries etc.) are left
        open: an opening with no door block is still an opening. Virtual ones are zone lines, not walls."""
        built, skipped = 0, 0
        for c in self.L["closures"]:
            if c.get("virtual"): continue
            (x0, y0), (x1, y1) = c["a"], c["b"]; ln, an, cx, cy = seg_frame(x0, y0, x1, y1)
            if ln < 0.05: continue
            if c.get("source") == "auto" and not self._near_edge(cx, cy, 1.2): skipped += 1; continue
            m = self.mb(); m.box(ln + 0.02, 0.12, self.Hs + 0.018, Matrix(), self.mat("walls", "paint", "paint"))
            self.R.put("WALL", "closure_cad", m.build("closure"), T(cx, cy, -0.018) @ RZ(an), props={"static": 1, "why": c.get("why", "")[:80]}); built += 1
        self.log("cad_closures", {"built": built, "interior_auto_left_open": skipped})

    def context(self):
        """What the windows look out on: a ground plane at street level, the Overture buildings around the site as
        plain extruded blocks (heights from the data, else floors x 3.4 m, else 9-30 m), and the physical sky."""
        import os, json as _j
        st = self.L["storeys"]; lvl = st.get("level", st.get("volt_level", 1)); f2f = st.get("floor_to_floor", 4.1); zg = -lvl * f2f
        if st.get("ffl_m") is not None: zg = -st["ffl_m"]          # RTP: finished floor level above the ground, given by the layout
        m = self.mb(); m.quad(-700, -700, 760, 760, zg, self.mat("context", "ground", "ground")); self.R.put("CONTEXT", "ground", m.build("ground"))
        path = self.S.get("context", {}).get("buildings", os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../reconstruction/context_overture.json"))
        sf = self.L.get("site_fit") or {}
        if not os.path.exists(path) or not sf.get("plate_centroid"): self.log("context", "no context file or site_fit"); return
        C = _j.load(open(path)); rho = math.radians(sf.get("rot_deg", 0.0)); c_, s_ = math.cos(-rho), math.sin(-rho)
        pc, fc = sf["plate_centroid"], sf["footprint_centroid"]; dx, dy = sf.get("dx", 0.0), sf.get("dy", 0.0)
        def to_plan(e, n):
            u, v = e - fc[0] - dx, n - fc[1] - dy; return (c_ * u - s_ * v + pc[0], s_ * u + c_ * v + pc[1])
        xs = [p[0] for f in self.L["floor"] for p in f["outer"]]; ys = [p[1] for f in self.L["floor"] for p in f["outer"]]
        bb = (min(xs) - 6, min(ys) - 6, max(xs) + 6, max(ys) + 6); mm = self.mb(); n = 0
        for b in C.get("buildings", []):
            ring = [to_plan(*p) for p in b["ring"][:-1]] if len(b["ring"]) > 3 else None
            if not ring: continue
            cx = sum(p[0] for p in ring) / len(ring); cy = sum(p[1] for p in ring) / len(ring)
            if bb[0] < cx < bb[2] and bb[1] < cy < bb[3]: continue          # our own building
            if math.hypot(cx - pc[0], cy - pc[1]) > 450: continue
            h = b.get("height") or ((b.get("floors") or 0) * 3.4) or (9 + (hash(b.get("id", "")) % 2200) / 100.0)
            try: mm.prism(ring, zg, zg + h, self.mat("context", "block", "context_block"))
            except Exception: continue
            n += 1
        if n: self.R.put("CONTEXT", "overture_blocks", mm.build("context", normals=False))
        self.log("context", {"buildings": n, "ground_z": zg, "source": os.path.basename(path)})

    # -------------------------------------------------------------- walls, skirting, columns
    def walls(self):
        L = self.L; paint = self.mat("walls", "paint", "paint")
        objs = []
        for i, w in enumerate(L["walls"]):
            m = self.mb(); m.prism(w["outer"], -0.018, self.Hs, paint, holes=w["holes"])
            objs.append(self.R.put("WALL", "wall", m.build(f"wall{i}", normals=False), props={"static": 1}))
        self._cut(objs)
        from twin_lib import bevel_bm, weighted_normals
        import bmesh
        for o in objs:
            bm = bmesh.new(); bm.from_mesh(o.data); bevel_bm(bm, 0.008, (-0.018, self.Hs)); bm.to_mesh(o.data); bm.free()
            for p in o.data.polygons: p.use_smooth = True
            weighted_normals(o.data)
            from twin_lib import box_uv; box_uv(o.data)
        self.wall_objs = objs
        sk = self.mat("walls", "skirting", "charcoal")
        for i, w in enumerate(L["skirting"]):
            m = self.mb(); m.prism(w["outer"], 0.0, 0.09, sk, holes=w["holes"], bevel=0.003)
            self.R.put("SKIRTING", "skirting", m.build(f"skirting{i}"), props={"static": 1})
        col = self.mat("walls", "column", "charcoal")
        for i, c in enumerate(L["columns"]):
            m = self.mb(); m.prism(c, -0.018, self.Hs, col, bevel=0.01, ends=True)
            self.R.put("COLUMN", "column", m.build(f"column{i}"), props={"static": 1})

    def _cut(self, objs):
        """Open the wall strip where glass stands in it (the CAD draws glass along an unbroken wall line)."""
        if not self.cuts: return
        cm = {}
        cutters = []
        for (cx, cy, an, ln, tc, th, z0, z1) in self.cuts:
            m = MB(self.M); m.box(ln, th, z1 - z0, Matrix(), "paint")
            o = bpy.data.objects.new("cutter", m.build("cutter", normals=False)); bpy.context.scene.collection.objects.link(o)
            o.matrix_world = T(cx, cy, z0) @ RZ(an) @ T(0, tc, 0); cutters.append(o)
        bpy.context.view_layer.update()
        for o in objs:
            xs = [v.co.x for v in o.data.vertices]; ys = [v.co.y for v in o.data.vertices]; b = (min(xs), min(ys), max(xs), max(ys)); used = 0
            for c, cut in zip(cutters, self.cuts):
                r = cut[3] / 2 + cut[5] + abs(cut[4])
                if cut[0] + r < b[0] or cut[0] - r > b[2] or cut[1] + r < b[1] or cut[1] - r > b[3]: continue
                md = o.modifiers.new("cut", "BOOLEAN"); md.operation = "DIFFERENCE"; md.object = c; used += 1
                try: md.solver = "EXACT"
                except Exception: pass
            if not used: continue
            try:
                me = bpy.data.meshes.new_from_object(o.evaluated_get(bpy.context.evaluated_depsgraph_get()))
                o.modifiers.clear()
                if len(me.polygons) > 0: o.data = me
            except Exception as ex: print("wall opening skipped:", ex); o.modifiers.clear()
        for c in cutters: bpy.data.objects.remove(c)

    # -------------------------------------------------------------- enclosure: every metre of the floor edge has a wall or glass
    def enclosure(self):
        """Walk the floor outline; wherever there is neither a wall nor a glass line within 0.35 m, build a closing wall
        (assumed, logged). So no camera ever looks out into the cut-open edge of the plate or a neighbouring floor."""
        L = self.L; glass = [(g[0], g[1], g[2], g[3]) for g in L["glass"]]
        def near_glass(x, y):
            for (x0, y0, x1, y1) in glass:
                dx, dy = x1 - x0, y1 - y0; l2 = dx * dx + dy * dy
                if l2 < 1e-6: continue
                t = max(0, min(1, ((x - x0) * dx + (y - y0) * dy) / l2))
                if math.hypot(x0 + t * dx - x, y0 + t * dy - y) < 0.35: return True
            return False
        added = []
        for f in L["floor"]:
            ring = f["outer"]
            for i in range(len(ring)):
                (x0, y0), (x1, y1) = ring[i], ring[(i + 1) % len(ring)]; ln, an, _, _ = seg_frame(x0, y0, x1, y1)
                if ln < 0.05: continue
                ux, uy = (x1 - x0) / ln, (y1 - y0) / ln; nx, ny = -uy, ux
                n = max(2, int(ln / 0.25)); gaps = []
                for k in range(n + 1):
                    u = ln * k / n; px, py = x0 + ux * u, y0 + uy * u
                    ok = near_glass(px, py) or any(self.in_wall(px + nx * s, py + ny * s) for s in (-0.3, -0.15, -0.05, 0.0, 0.05, 0.15, 0.3))
                    gaps.append(not ok)
                k = 0
                while k <= n:
                    if gaps[k]:
                        j = k
                        while j + 1 <= n and gaps[j + 1]: j += 1
                        u0, u1 = max(0, ln * (k - 0.5) / n), min(ln, ln * (j + 0.5) / n)
                        if u1 - u0 > 0.2:
                            inside = in_poly(x0 + ux * (u0 + u1) / 2 + nx * 0.3, y0 + uy * (u0 + u1) / 2 + ny * 0.3, ring)
                            s = -1 if inside else 1; cx, cy = x0 + ux * (u0 + u1) / 2 + nx * s * 0.1, y0 + uy * (u0 + u1) / 2 + ny * s * 0.1
                            if self.S.get("closure_offsets"):      # opt-in: no face shared with the slabs or the next closure (2 mm coplanar rule)
                                kk = len(added) % 2; dz = 0.004 + 0.003 * kk; th = 0.19 - 0.006 * kk     # outer face 5+ mm inside the slab edge
                                m = self.mb(); m.box(u1 - u0 + 0.2, th, self.Hs + 0.6 - 2 * dz, Matrix(), self.mat("walls", "paint", "paint"))
                                self.R.put("WALL", "closure", m.build("closure"), T(cx, cy, -0.3 + dz) @ RZ(an), props={"static": 1, "assumed": 1})
                            else:
                                m = self.mb(); m.box(u1 - u0 + 0.2, 0.2, self.Hs + 0.3 + 0.3, Matrix(), self.mat("walls", "paint", "paint"))
                                self.R.put("WALL", "closure", m.build("closure"), T(cx, cy, -0.3) @ RZ(an), props={"static": 1, "assumed": 1})
                            added.append([round(x0 + ux * u0, 2), round(y0 + uy * u0, 2), round(x0 + ux * u1, 2), round(y0 + uy * u1, 2)])
                        k = j + 1
                    else: k += 1
        self.log("enclosure_closures", added)
        if added: print(f"enclosure: {len(added)} stretch(es) of the floor edge had no wall or glass; closed with an assumed wall", flush=True)

    # -------------------------------------------------------------- atrium: glass balustrade, shaft walls above and below
    def atrium(self):
        a = self.L.get("atrium")
        if not a: return
        xs = [p[0] for p in a]; ys = [p[1] for p in a]; ax0, ax1, ay0, ay1 = min(xs), max(xs), min(ys), max(ys)
        st = self.L["storeys"]; f2f = st.get("floor_to_floor", 4.1)
        try: above = int(str(st.get("count", "G+4")).split("+")[1]) - int(st.get("volt_level", st.get("level", 1)))
        except Exception: above = 2
        g = "partition_glass"; fr = self.mat("glass", "rail", "steel")
        for k, (x0, y0, x1, y1) in enumerate([(ax0, ay0, ax1, ay0), (ax1, ay0, ax1, ay1), (ax1, ay1, ax0, ay1), (ax0, ay1, ax0, ay0)]):
            ln, an, cx, cy = seg_frame(x0, y0, x1, y1)
            m = self.mb(); m.box(ln, 0.012, 1.0, T(0, 0, 0.05), g); m.box(ln, 0.05, 0.04, T(0, 0, 1.05), fr, 0.008); m.box(ln, 0.04, 0.05, Matrix(), fr, 0.004)
            self.R.put("RAILING", "atriumbalustrade", m.build("balustrade"), T(cx, cy, 0) @ RZ(an))
            m = self.mb(); m.box(ln, 0.2, 4.1, T(0, 0, -4.1), "paint"); m.box(ln, 0.2, max(0.5, above * f2f + (f2f - self.Hs)), T(0, 0, self.Hs), "paint")
            # the shaft wall sits just outside the hole, so the balustrade never touches it
            ox, oy = -math.sin(an) * -0.11, math.cos(an) * -0.11
            self.R.put("WALL", "atriumshaft", m.build("shaft"), T(cx + ox, cy + oy, 0) @ RZ(an), props={"static": 1})
        m = self.mb(); m.quad(ax0, ay0, ax1, ay1, -4.1, self.mat("floors", "stone", "stone")); self.R.put("CONTEXT", "atriumfloor", m.build("atrium_floor"))

    # -------------------------------------------------------------- glass partitions and facade windows
    def glazing(self):
        # fixed names, so the web viewer can find them: facade_glass, partition_glass, partition_glass_frost (looks from the style)
        G = self.S.get("glass", {}); pane = "partition_glass"; frame = G.get("frame", "black_metal"); frost = "partition_glass_frost"
        band = G.get("frost_band", {"z": 0.95, "stripes": 7, "stripe_h": 0.056, "gap": 0.022, "pattern": "stripes"})
        blind = self.S.get("facade", {}).get("blind", "blind"); ffr = self.S.get("facade", {}).get("frame", frame)
        rnd = random.Random(5)
        for run in self.runs:
            ln, an, (cx, cy), n, st, facade, s_in = run["len"], run["an"], run["c"], run["n"], run["strip"], run["facade"], run["in"]
            ca, sa = math.cos(an), math.sin(an); nx, ny = -sa, ca
            if st: z0, z1 = (self.SILL, self.HEAD) if facade else (self.GB, self.GT)
            else: z0, z1 = 0.0, (self.Hs if facade else self.H)        # full-height glazing: to the soffit (facade) or the ceiling
            tc = 0.0 if (facade or not st) else (st[0] + st[1]) / 2
            gx, gy = cx + nx * tc, cy + ny * tc; m = self.mb(); fm = ffr if facade else frame
            m.box(ln - 0.02, 0.010, z1 - z0 - 0.08, T(0, 0, z0 + 0.04), "facade_glass" if facade else pane)     # 10 mm: two faces, outward normals
            m.box(ln, 0.05, 0.04, T(0, 0, z0), fm, 0.004); m.box(ln, 0.05, 0.04, T(0, 0, z1 - 0.04), fm, 0.004)
            for i in range(n + 1):
                u = -ln / 2 + ln * i / n; uu = max(-ln / 2 + 0.02, min(ln / 2 - 0.02, u))
                m.box(0.04, 0.05, z1 - z0 - 0.08, T(uu, 0, z0 + 0.04), fm, 0.004)
            if not facade:
                pat = band.get("pattern", "stripes"); zb = band.get("z", 0.95)
                if pat == "solid": m.box(ln - 0.06, 0.016, band.get("height", 0.6), T(0, 0, zb), frost)
                elif pat in ("chevron", "diamond"):
                    # a row of frosted diamonds (or chevrons) on the glass: flat quads 2 mm in front of the pane, both faces
                    w = band.get("cell", 0.3); hh = band.get("height", 0.5); cnt = max(1, int((ln - 0.1) / w))
                    for side in (-1, 1):
                        y = side * 0.008
                        for k in range(cnt):
                            u = -ln / 2 + 0.05 + (k + 0.5) * (ln - 0.1) / cnt; h2 = hh / 2; zc = zb + h2; s = 0.45 * w
                            vs = [(u - s, y, zc), (u, y, zc - h2 * 0.9), (u + s, y, zc), (u, y, zc + h2 * 0.9)] if pat == "diamond" else \
                                 [(u - s, y, zc - h2 * 0.5), (u, y, zc + h2 * 0.2), (u + s, y, zc - h2 * 0.5), (u + s, y, zc - h2 * 0.1), (u, y, zc + h2 * 0.6), (u - s, y, zc - h2 * 0.1)]
                            m.add(vs, [tuple(range(len(vs))) if side > 0 else tuple(reversed(range(len(vs))))], frost)
                else:
                    for k in range(band.get("stripes", 7)):
                        m.box(ln - 0.06, 0.016, band.get("stripe_h", 0.056), T(0, 0, zb + k * (band.get("stripe_h", 0.056) + band.get("gap", 0.022))), frost)
            self.R.put("GLASS", tok(run["layer"]), m.build("glass"), T(gx, gy, 0) @ RZ(an), props={"facade": int(facade)})
            if facade:
                self.portals.append((cx, cy, ca, sa, nx * s_in, ny * s_in, ln, z0 + 0.04, z1 - 0.04))
                if st and self.S.get("facade", {}).get("blinds", True):
                    near, far = (st[0], st[1]) if s_in > 0 else (-st[1], -st[0]); top = self.HEAD + 0.12
                    bx, by = cx + nx * s_in * (far + 0.035), cy + ny * s_in * (far + 0.035)
                    mb = self.mb(); mb.box(ln, 0.05, 0.05, T(0, 0, top), "white_metal", 0.006)
                    for i in range(n):
                        u = -ln / 2 + ln * (i + 0.5) / n; drop = rnd.choice(self.S.get("facade", {}).get("blind_drops", (0.45, 0.6, 0.6, 0.8)))
                        mb.box(ln / n - 0.04, 0.004, drop, T(u, 0, top - drop), blind)
                    self.R.put("BLIND", "rollerblind", mb.build("blind"), T(bx, by, 0) @ RZ(an))

    # -------------------------------------------------------------- doors: leaf as drawn (open), frame in the wall opening, header above
    def doors(self):
        D = self.S.get("doors", {}); glass_lines = [g for g in self.L["glass"]]
        def blocked(x, y):
            if self.in_wall(x, y): return True
            for g in glass_lines:
                x0, y0, x1, y1 = g[:4]; dx, dy = x1 - x0, y1 - y0; l2 = dx * dx + dy * dy
                if l2 < 1e-6: continue
                t = ((x - x0) * dx + (y - y0) * dy) / l2
                if 0 <= t <= 1 and math.hypot(x0 + t * dx - x, y0 + t * dy - y) < 0.05: return True
            return False
        found = 0
        for d in self.L["doors"]:
            cx, cy, w, a = d["c"][0], d["c"][1], d["w"], d["a"]; ca, sa = math.cos(a), math.sin(a)
            best = None
            if d.get("_cad_opening") and d["_cad_opening"][3] > 0.4:
                ox, oy, oa, ow = d["_cad_opening"]; best = (99, ox, oy, oa, None, None); w = ow
            # The plan draws the leaf open. The opening is beside it: hinge at one end of the leaf, running
            # perpendicular to it for the leaf's width. Of the four candidates, take the one that is clear along its
            # length and has wall (or glass) just past both ends: the jambs.
            for e in ((-1, 1) if best is None else ()):
                for sh in (0.0, -0.05, 0.05, -0.1, 0.1, -0.15, 0.15):
                    hx, hy = cx + ca * (e * w / 2 + sh), cy + sa * (e * w / 2 + sh)
                    for s in (-1, 1):
                        ox, oy = -sa * s, ca * s
                        clear = sum(not blocked(hx + ox * w * t, hy + oy * w * t) for t in (0.15, 0.3, 0.5, 0.7, 0.85))
                        jl = blocked(hx - ox * 0.08, hy - oy * 0.08) or blocked(hx - ox * 0.14, hy - oy * 0.14)
                        jr = blocked(hx + ox * (w + 0.08), hy + oy * (w + 0.08)) or blocked(hx + ox * (w + 0.14), hy + oy * (w + 0.14))
                        if not (jl and jr) or clear < 4: continue
                        sc = clear * 2 - abs(sh) * 10
                        if best is None or sc > best[0]: best = (sc, hx + ox * w / 2, hy + oy * w / 2, math.atan2(oy, ox), hx, hy)
            leaf_mat = "partition_glass" if d.get("glass") else (D.get("fire_leaf", "charcoal") if d.get("fire") else D.get("leaf", "oak"))
            m = self.mb(); th = 0.012 if d.get("glass") else max(0.04, d.get("d", 0.04))
            m.box(w - 0.02, th, 2.08, T(0, 0, 0.01), leaf_mat, 0 if d.get("glass") else 0.003)
            if d.get("glass"):
                m.box(w - 0.02, 0.03, 0.06, T(0, 0, 0.01), D.get("frame", "black_metal"), 0.003); m.box(w - 0.02, 0.03, 0.06, T(0, 0, 2.03), D.get("frame", "black_metal"), 0.003)
            for s_ in (-1, 1): m.box(0.025, 0.03, 0.3, T(w / 2 - 0.09, 0.035 * s_ - (0.0 if s_ > 0 else 0), 0.95), D.get("handle", "alu"), 0.008)
            lo = self.R.put("DOOR", tok(d.get("block", "door")) + "leaf", m.build("door_leaf"), T(cx, cy, 0) @ RZ(a), props={"cad_door": 1}); d["_leaf"] = lo.name
            if best:
                found += 1; _, ox, oy, oa, hx, hy = best
                # frame (jambs + head) and the header that closes the wall above the door up to the soffit
                fm = self.mb(); fmat = D.get("frame", "black_metal"); depth = 0.12
                for e in (-1, 1): fm.box(0.05, depth, 2.15, T(e * (w / 2 + 0.025), 0, 0), fmat, 0.004)
                fm.box(w + 0.1, depth, 0.05, T(0, 0, 2.15), fmat, 0.004)
                self.R.put("DOOR", tok(d.get("block", "door")) + "frame", fm.build("door_frame"), T(ox, oy, 0) @ RZ(oa))
                hm = self.mb(); hm.box(w + 0.2, 0.1, self.Hs - 2.2, T(0, 0, 2.2), self.mat("walls", "paint", "paint"))
                self.R.put("WALL", "doorheader", hm.build("door_header"), T(ox, oy, 0) @ RZ(oa), props={"static": 1})
                d["_opening"] = [round(ox, 3), round(oy, 3), round(oa, 4), w]
            else:
                d["_opening"] = None
        self.log("doors", {"count": len(self.L["doors"]), "openings_found": found})
        print(f"doors: {len(self.L['doors'])} leaves, {found} frames placed in a wall/glass opening", flush=True)

    # -------------------------------------------------------------- ceilings per room
    def ceiling_spec(self, r):
        C = self.S.get("ceilings", {}); kind = room_kind(self.S, r["name"], r.get("kind"))
        spec = dict(C.get("default", {"type": "plain"}))
        spec.update(C.get("kinds", {}).get(kind, {}))
        for pat, sp in C.get("rooms", {}).items():
            import re
            if re.search(pat, r["name"], re.I): spec.update(sp)
        return spec, kind

    def ceilings(self):
        ras = self.ras; rnd = random.Random(11)
        lights_by_room = {}
        for l in self.L["lights"]:
            rr = ras.room_at(*l["c"]); key = rr["name"] if rr else None
            lights_by_room.setdefault(key, []).append(l)
        no_lights = self.S.get("no_light_rooms", "UPS|Server")
        self.lights = []      # (x, y, kind, room, assumed, ceiling type, mount z)
        assumed_rooms = []
        import re
        for k, r in enumerate(ras.rooms):
            cells = ras.label == k
            if not cells.any(): continue
            rects = ras.rects(cells); self._cells = cells; spec, kind = self.ceiling_spec(r); typ = spec.get("type", "plain"); H = spec.get("height", self.H)
            self.ceiling_of[r["name"]] = {"type": typ, "height": H, "kind": kind}
            xs = [p for rc in rects for p in (rc[0], rc[2])]; ys = [p for rc in rects for p in (rc[1], rc[3])]; bb = (min(xs), min(ys), max(xs), max(ys))
            ls = list(lights_by_room.get(r["name"], []))
            if not ls and not re.search(no_lights, r["name"], re.I):
                g = spec.get("assumed_grid", 1.8); nx_, ny_ = max(1, round((bb[2] - bb[0]) / g)), max(1, round((bb[3] - bb[1]) / g))
                for i in range(nx_):
                    for j in range(ny_):
                        x, y = bb[0] + (i + .5) * (bb[2] - bb[0]) / nx_, bb[1] + (j + .5) * (bb[3] - bb[1]) / ny_
                        if ras.room_at(x, y) is r: ls.append({"c": [x, y], "kind": spec.get("assumed_kind", "downlight"), "assumed": True})
                if ls: assumed_rooms.append(r["name"])
            getattr(self, "ceil_" + typ, self.ceil_plain)(r, rects, bb, spec, H, ls, rnd)
        self.log("assumed_light_rooms", assumed_rooms)

    def _mount(self, r, x, y, l, typ, z, assumed):
        self.lights.append({"x": x, "y": y, "kind": l.get("kind", "downlight"), "room": r["name"], "assumed": bool(assumed), "ceiling": typ, "z": z})

    def ceil_plain(self, r, rects, bb, spec, H, ls, rnd):
        m = self.mb()
        self.surface(m, self._cells, H, spec.get("board", "gypsum"), down=True)
        self.R.put("CEILING", f"{r['slug']}_board", m.build("ceil"), props={"room": r["name"], "static": 1})
        for l in ls: self._mount(r, l["c"][0], l["c"][1], l, "plain", H, l.get("assumed"))

    def ceil_grid(self, r, rects, bb, spec, H, ls, rnd):
        t = spec.get("tile_size", 0.6)
        panels = [l for l in ls if l.get("kind") == "panel600"]
        ox = (panels[0]["c"][0] - t / 2) % t if panels else bb[0] % t; oy = (panels[0]["c"][1] - t / 2) % t if panels else bb[1] % t
        m = self.mb()
        self.surface(m, self._cells, H, spec.get("tile", "ceiling_tile"), down=True)
        self.R.put("CEILING", f"{r['slug']}_tiles", m.build("tiles"), props={"room": r["name"], "static": 1})
        # T-grid: main runners along x (14 mm deep), cross tees along y (12 mm deep): their undersides are 2 mm apart
        g = self.mb(); gm = spec.get("grid", "white_metal")
        for (x0, y0, x1, y1) in rects:
            yv = oy + math.ceil((y0 - oy) / t) * t
            while yv < y1 - 0.01:
                if yv > y0 + 0.01: g.box(x1 - x0, 0.024, 0.014, T((x0 + x1) / 2, yv, H - 0.014), gm)
                yv += t
            xv = ox + math.ceil((x0 - ox) / t) * t
            while xv < x1 - 0.01:
                if xv > x0 + 0.01: g.box(0.024, y1 - y0, 0.012, T(xv, (y0 + y1) / 2, H - 0.012), gm)
                xv += t
        if not g.empty(): self.R.put("CEILING", f"{r['slug']}_tgrid", g.build("tgrid", normals=False), props={"room": r["name"]})
        # cells: lights take theirs; AC grilles on a regular pattern (assumed); accent tiles scattered (style)
        cells = []
        for (x0, y0, x1, y1) in rects:
            i0 = math.ceil((x0 - ox) / t); i1 = math.floor((x1 - ox) / t); j0 = math.ceil((y0 - oy) / t); j1 = math.floor((y1 - oy) / t)
            for i in range(i0, i1):
                for j in range(j0, j1): cells.append((i, j))
        lit = set()
        for l in ls: lit.add((math.floor((l["c"][0] - ox) / t), math.floor((l["c"][1] - oy) / t)))
        acs, acc = [], []
        every = spec.get("ac_every", 0)
        for (i, j) in cells:
            if (i, j) in lit: continue
            if every and i % every == 1 and j % every == 2: acs.append((i, j)); continue
            if spec.get("accent") and rnd.random() < spec.get("accent_fraction", 0.05): acc.append((i, j))
        if acc:
            a = self.mb()
            for (i, j) in acc:
                x, y = ox + (i + 0.5) * t, oy + (j + 0.5) * t; a.quad(x - t / 2 + 0.012, y - t / 2 + 0.012, x + t / 2 - 0.012, y + t / 2 - 0.012, H - 0.003, spec["accent"], down=True)
            self.R.put("CEILING", f"{r['slug']}_accent", a.build("accent", normals=False), props={"room": r["name"]})
        if acs:
            me = self.c.proto("ac_grille", lambda: self._ac_grille(spec))
            for (i, j) in acs: self.R.put("HVAC", "acgrille", me, T(ox + (i + 0.5) * t, oy + (j + 0.5) * t, H - 0.004), props={"assumed": 1})
        if spec.get("perimeter_band"):
            # a gypsum band round the room's own outline (from the raster, so it never crosses into a neighbour), its
            # inner lip lit by an LED strip that washes the tiles
            pb = spec["perimeter_band"]; wb = pb.get("width", 0.6); dr = pb.get("drop", 0.15); zb = H - dr
            cells = np.zeros(self.ras.label.shape, bool)
            for (x0, y0, x1, y1) in rects:
                i0, j0 = self.ras.ij(x0 + 1e-4, y0 + 1e-4); i1, j1 = self.ras.ij(x1 - 1e-4, y1 - 1e-4); cells[i0:i1 + 1, j0:j1 + 1] = True
            k = max(1, int(round(wb / self.ras.res))); inner = cells.copy()
            for _ in range(k):
                e = inner.copy(); e[1:, :] &= inner[:-1, :]; e[:-1, :] &= inner[1:, :]; e[:, 1:] &= inner[:, :-1]; e[:, :-1] &= inner[:, 1:]; e[0, :] = e[-1, :] = False; e[:, 0] = e[:, -1] = False; inner = e
            band = cells & ~inner
            if inner.sum() * self.ras.res ** 2 > 2.0:
                bm = self.mb()
                for (x0, y0, x1, y1) in self.ras.rects(band): bm.box(x1 - x0, y1 - y0, dr - 0.003, T((x0 + x1) / 2, (y0 + y1) / 2, zb), pb.get("board", "gypsum"))
                lip = band.copy(); g = np.zeros_like(inner); g[1:, :] |= inner[:-1, :]; g[:-1, :] |= inner[1:, :]; g[:, 1:] |= inner[:, :-1]; g[:, :-1] |= inner[:, 1:]; lip &= g
                for (x0, y0, x1, y1) in self.ras.rects(lip): bm.quad(x0, y0, x1, y1, zb - 0.003, pb.get("cove", "cove_led"), down=True)
                self.R.put("CEILING", f"{r['slug']}_perimeterband", bm.build("band", normals=False), props={"room": r["name"], "static": 1})
                def in_band(x, y):
                    i, j = self.ras.ij(x, y); return 0 <= i < band.shape[0] and 0 <= j < band.shape[1] and band[i, j]
                ls = [dict(l, _band=zb) if in_band(*l["c"]) else l for l in ls]
        for l in ls: self._mount(r, l["c"][0], l["c"][1], l, "grid", l.get("_band", H), l.get("assumed"))

    def _ac_grille(self, spec):
        m = self.mb(); mat = spec.get("ac", "white_metal"); s = spec.get("ac_size", 0.58)
        if spec.get("ac_linear"):
            m.box(1.2, 0.18, 0.004, Matrix(), mat, 0.002)
            for k in range(4): m.box(1.18, 0.012, 0.012, T(0, -0.06 + k * 0.04, -0.012), "black_metal")
        else:
            m.box(s, s, 0.004, Matrix(), mat, 0.002)
            for k in range(1, 6): m.box(s * (1 - k * 0.16), s * (1 - k * 0.16), 0.006 * k, T(0, 0, -0.006 * k), mat, 0.001)
        return m.build("ac_grille")

    def ceil_open(self, r, rects, bb, spec, H, ls, rnd):
        Hs = self.Hs; m = self.mb(); sof = spec.get("soffit", "soffit_paint")
        self.surface(m, self._cells, Hs - 0.003, sof, down=True)
        self.R.put("CEILING", f"{r['slug']}_soffitpaint", m.build("soffit"), props={"room": r["name"], "static": 1})
        along_x = (bb[2] - bb[0]) >= (bb[3] - bb[1]); L_ = (bb[2] - bb[0]) if along_x else (bb[3] - bb[1]); W_ = (bb[3] - bb[1]) if along_x else (bb[2] - bb[0])
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2; rot = 0.0 if along_x else math.pi / 2; M0 = T(cx, cy, 0) @ RZ(rot)
        svc = self.mb(); duct = spec.get("duct", sof); tray = spec.get("tray", sof); sp = spec.get("sprinkler", "sprinkler_red")
        if L_ > 2.0 and W_ > 1.6:
            svc.box(L_ - 0.4, 0.6, 0.35, M0 @ T(0, -W_ * 0.18, Hs - 0.05 - 0.35), duct, 0.01)            # main duct
            for k in range(int(L_ / 3.0)):
                u = -L_ / 2 + (k + 0.5) * L_ / int(L_ / 3.0)
                svc.cyl(0.11, W_ * 0.3, M0 @ T(u, -W_ * 0.18 + 0.3, Hs - 0.25) @ Matrix.Rotation(-math.pi / 2, 4, "X"), duct, 18)   # branch
            for e in (-1, 1):                                                                      # cable tray (mesh tray: side rails + rungs)
                svc.box(L_ - 0.4, 0.02, 0.06, M0 @ T(0, W_ * 0.2 + e * 0.15, Hs - 0.5), tray, 0.003)
            for k in range(int((L_ - 0.4) / 0.3)):
                svc.box(0.012, 0.3, 0.008, M0 @ T(-L_ / 2 + 0.2 + k * 0.3, W_ * 0.2, Hs - 0.5), tray)
            for k in range(int((L_ - 0.4) / 1.5) + 1):
                svc.rod((0, 0, 0), (0, 0, 0.44), 0.004, 0.004, tray, M0 @ T(-L_ / 2 + 0.2 + k * 1.5, W_ * 0.2 - 0.16, Hs - 0.44), 6)
        if svc.f: self.R.put("SERVICES", f"{r['slug']}_ductstray", svc.build("services", normals=False), props={"room": r["name"]})
        p = self.mb(); n = max(1, int(W_ / 3.0))
        for k in range(n):
            v = -W_ / 2 + (k + 0.5) * W_ / n
            p.rod((-L_ / 2 + 0.2, v, 0), (L_ / 2 - 0.2, v, 0), 0.025, 0.025, sp, M0 @ T(0, 0, Hs - 0.15), 12)
            for kk in range(max(1, int(L_ / 3.0))):
                u = -L_ / 2 + (kk + 0.5) * L_ / max(1, int(L_ / 3.0))
                p.rod((u, v, 0), (u, v, -0.25), 0.012, 0.012, sp, M0 @ T(0, 0, Hs - 0.15), 8); p.cyl(0.02, 0.03, M0 @ T(u, v, Hs - 0.43), "alu", 10)
        self.R.put("SERVICES", f"{r['slug']}_sprinkler", p.build("sprinkler", normals=False), props={"room": r["name"]})
        if spec.get("raft"):                    # an acoustic felt raft hung under the soffit (Paytm meeting rooms)
            inset = spec.get("raft_inset", 0.7)
            if bb[2] - bb[0] > 2 * inset + 0.6 and bb[3] - bb[1] > 2 * inset + 0.6:
                rm = self.mb(); rz = spec.get("raft_z", H + 0.05); rm.box(bb[2] - bb[0] - 2 * inset, bb[3] - bb[1] - 2 * inset, 0.05, T(cx, cy, rz), spec["raft"], 0.01)
                for e in ((-1, -1), (-1, 1), (1, -1), (1, 1)):
                    rm.rod((0, 0, 0), (0, 0, Hs - rz - 0.05), 0.002, 0.002, "black_metal", T(cx + e[0] * ((bb[2] - bb[0]) / 2 - inset - 0.2), cy + e[1] * ((bb[3] - bb[1]) / 2 - inset - 0.2), rz + 0.05), 6)
                self.R.put("CEILING", f"{r['slug']}_raft", rm.build("raft"), props={"room": r["name"]})
        if spec.get("linear_pendant"):
            self.c.extra_pendants.append((r, dict(spec, pendant_length=spec.get("pendant_length", 1.6)), (cx, cy), spec.get("pendant_z", 2.75) + 0.6, along_x))
        for l in ls: self._mount(r, l["c"][0], l["c"][1], l, "open", spec.get("pendant_z", 2.75), l.get("assumed"))
        if spec.get("pendant") == "capsule" and spec.get("capsule_over_desks"):
            self.c.capsule_rooms.append((r, spec))

    def ceil_cove(self, r, rects, bb, spec, H, ls, rnd):
        m = self.mb(); board = spec.get("board", "gypsum")
        self.surface(m, self._cells, H, board, down=True)
        self.R.put("CEILING", f"{r['slug']}_board", m.build("ceil"), props={"room": r["name"], "static": 1})
        inset = spec.get("inset", 0.6); drop = spec.get("raft_drop", 0.2); big = [rc for rc in rects if rc[2] - rc[0] > 2 * inset + 0.4 and rc[3] - rc[1] > 2 * inset + 0.4]
        raft = None
        if big:
            rc = max(big, key=lambda q: (q[2] - q[0]) * (q[3] - q[1])); x0, y0, x1, y1 = rc[0] + inset, rc[1] + inset, rc[2] - inset, rc[3] - inset
            zb = H - drop; rm = self.mb(); rm.box(x1 - x0, y1 - y0, 0.06, T((x0 + x1) / 2, (y0 + y1) / 2, zb), spec.get("raft", board), 0.006)
            lip = 0.05
            for (a, b_, c_, d_) in ((x0, y0, x1, y0 + 0.02), (x0, y1 - 0.02, x1, y1), (x0, y0 + 0.02, x0 + 0.02, y1 - 0.02), (x1 - 0.02, y0 + 0.02, x1, y1 - 0.02)):
                rm.box(c_ - a, d_ - b_, lip, T((a + c_) / 2, (b_ + d_) / 2, zb + 0.06), spec.get("raft", board))
            for (a, b_, c_, d_) in ((x0 + 0.04, y0 + 0.03, x1 - 0.04, y0 + 0.05), (x0 + 0.04, y1 - 0.05, x1 - 0.04, y1 - 0.03), (x0 + 0.03, y0 + 0.05, x0 + 0.05, y1 - 0.05), (x1 - 0.05, y0 + 0.05, x1 - 0.03, y1 - 0.05)):
                rm.quad(a, b_, c_, d_, zb + 0.063, spec.get("cove", "cove_led"))      # the LED strip, 3 mm above the raft top, facing up
            for k in range(2):     # four hanger rods
                pass
            self.R.put("CEILING", f"{r['slug']}_raft", rm.build("raft"), props={"room": r["name"], "static": 1})
            raft = (x0, y0, x1, y1, zb)
        for l in ls:
            x, y = l["c"]
            z = raft[4] if raft and raft[0] < x < raft[2] and raft[1] < y < raft[3] else H
            self._mount(r, x, y, l, "cove", z, l.get("assumed"))
        if spec.get("pendant") and raft:
            self.c.extra_pendants.append((r, spec, ((raft[0] + raft[2]) / 2, (raft[1] + raft[3]) / 2), raft[4], (raft[2] - raft[0]) >= (raft[3] - raft[1])))

    def ceil_baffle(self, r, rects, bb, spec, H, ls, rnd):
        Hs = self.Hs; m = self.mb()
        self.surface(m, self._cells, Hs - 0.003, spec.get("soffit", "soffit_paint"), down=True)
        self.R.put("CEILING", f"{r['slug']}_soffitpaint", m.build("soffit"), props={"room": r["name"], "static": 1})
        b = self.mb(); pitch = spec.get("pitch", 0.15); dep = spec.get("depth", 0.15); wd = spec.get("width", 0.03); mat = spec.get("slat", "oak")
        along_x = (bb[2] - bb[0]) >= (bb[3] - bb[1])
        for (x0, y0, x1, y1) in rects:
            if along_x:
                x = x0 + pitch / 2
                while x < x1 - wd: b.box(wd, y1 - y0 - 0.04, dep, T(x, (y0 + y1) / 2, H), mat, 0.003); x += pitch
            else:
                y = y0 + pitch / 2
                while y < y1 - wd: b.box(x1 - x0 - 0.04, wd, dep, T((x0 + x1) / 2, y, H), mat, 0.003); y += pitch
        self.R.put("CEILING", f"{r['slug']}_baffles", b.build("baffles"), props={"room": r["name"]})
        for l in ls: self._mount(r, l["c"][0], l["c"][1], l, "baffle", spec.get("pendant_z", H - 0.05), l.get("assumed"))
