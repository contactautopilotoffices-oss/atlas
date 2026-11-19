"""Shared helpers for the tenant-generic floor builder (build_floor.py, placement_check.py, make_cameras.py).

Everything here is tenant-neutral: the layout JSON says where things are (from CAD), the style JSON says what they
are made of. Nothing in this file knows about Volt, ARCIL or Paytm.
"""
import bpy, bmesh, json, math, os, re, sys, time, hashlib, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon

HERE = os.path.dirname(os.path.abspath(__file__))


# ------------------------------------------------------------------ small utilities
def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-") or "x"

def tok(s):
    """A block or layer name made safe for an object name (no spaces, no $ or quotes)."""
    return re.sub(r"[^A-Za-z0-9]+", "", str(s)) or "x"

def lin(hexs):
    hexs = hexs.lstrip("#"); c = [int(hexs[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)

def srgb_arr(hexs):
    hexs = hexs.lstrip("#"); return np.array([int(hexs[i:i + 2], 16) / 255 for i in (0, 2, 4)], dtype=np.float32)

def kelvin(t):
    """Blackbody colour of a colour temperature (Tanner Helland's fit), linear RGB."""
    t = t / 100.0
    r = 255.0 if t <= 66 else 329.698727446 * (t - 60) ** -0.1332047592
    g = 99.4708025861 * math.log(t) - 161.1195681661 if t <= 66 else 288.1221695283 * (t - 60) ** -0.0755148492
    b = 255.0 if t >= 66 else (0.0 if t <= 19 else 138.5177312231 * math.log(t - 10) - 305.0447927307)
    c = [min(255.0, max(0.0, v)) / 255 for v in (r, g, b)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)

def light_col(t, wb=4150.0, amount=1.0):
    c = kelvin(t); w = kelvin(wb); v = [a / b for a, b in zip(c, w)]; m = max(v); v = [a / m for a in v]
    return tuple(1 + (a - 1) * amount for a in v)

def deep_merge(a, b):
    out = dict(a)
    for k, v in b.items():
        out[k] = deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out

def load_style(path):
    S = json.load(open(path))
    if S.get("extends"):
        base = load_style(os.path.join(os.path.dirname(os.path.abspath(path)), S["extends"]))
        S = deep_merge(base, {k: v for k, v in S.items() if k != "extends"})
    return S

def script_args():
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


class Timer:
    """Prints and records wall-clock seconds per stage into <out>/<tenant>_timings.json (appends)."""
    def __init__(self, out, tenant):
        self.path = os.path.join(out, f"{tenant}_timings.json"); self.t = {}
        try: self.t = json.load(open(self.path))
        except Exception: pass
    def run(self, name, fn, *a, **k):
        t0 = time.time(); print(f"\n=== stage {name} ...", flush=True)
        r = fn(*a, **k); dt = round(time.time() - t0, 1)
        self.t[name] = {"seconds": dt, "at": time.strftime("%Y-%m-%d %H:%M:%S")}
        json.dump(self.t, open(self.path, "w"), indent=1)
        print(f"=== stage {name}: {dt} s", flush=True); return r


# ------------------------------------------------------------------ point in polygon (numpy, vectorised)
def pip(xs, ys, poly):
    """Even-odd test of many points against one polygon (list of (x, y))."""
    inside = np.zeros(xs.shape, dtype=bool); n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if y1 == y2: continue
        cond = (y1 > ys) != (y2 > ys)
        xint = (x2 - x1) * (ys - y1) / (y2 - y1) + x1
        inside ^= cond & (xs < xint)
    return inside

def in_poly(x, y, poly):
    c = False; j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c


# ------------------------------------------------------------------ layout normalisation (tolerant of extra / missing keys)
def norm_layout(L):
    """Fill defaults so builders can rely on keys. Unknown extra keys are kept untouched."""
    L = dict(L)
    L.setdefault("heights", {})
    hd = {"ceiling": 2.85, "wall": 2.85, "desk": 0.75, "high_desk": 1.05, "coffee": 0.42, "planter": 1.05}
    for k, v in hd.items(): L["heights"].setdefault(k, v)
    st = L.get("storeys") or {}; L["storeys"] = st; st.setdefault("floor_to_floor", 4.1)
    for k in ("walls", "glass", "columns", "rooms", "desks", "tables", "seats", "planters", "plants", "doors", "lights",
              "skirting", "fixtures", "extra_rooms", "labels", "railings"):
        L[k] = L.get(k) or []
    sh = L.get("shell") or {}
    if isinstance(sh, dict) and sh.get("outline"):
        # the CAD plate outline (outer architectural lines) is the floor; keep the old floor's holes (atrium etc.)
        holes = [h for f in (L.get("floor") or []) for h in f.get("holes", [])]
        L["floor_cad"] = L.get("floor"); L["floor"] = [{"outer": sh["outline"], "holes": holes}]
    if not L.get("floor"):
        b = L.get("bounds"); L["floor"] = [{"outer": [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]], "holes": []}]
    for f in L["floor"]: f.setdefault("holes", [])
    for w in L["walls"]: w.setdefault("holes", [])
    rooms = []
    for r in L["rooms"]:
        r = dict(r)
        if "poly" not in r:
            x0, y0, x1, y1 = r["box"]; r["poly"] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
        if "box" not in r:
            xs = [p[0] for p in r["poly"]]; ys = [p[1] for p in r["poly"]]; r["box"] = [min(xs), min(ys), max(xs), max(ys)]
        r.setdefault("floor", "carpet"); r["slug"] = slug(r["name"]); rooms.append(r)
    # walkway polygons from the CAD pipeline become rooms of their own (kind corridor), named after a label inside them
    # ("Lockers 150nos" -> "Locker corridor"), so they get a ceiling, finishes and cameras like any room
    circ = L.get("circulation")
    if isinstance(circ, dict):
        for i, c in enumerate(circ.get("polygons", [])):
            poly = c.get("poly") if isinstance(c, dict) else c
            if not poly or len(poly) < 3: continue
            xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
            labs = [l.get("clean", l.get("t", "")) for l in L.get("labels", []) if in_poly(l["x"], l["y"], poly)]
            nm = "Locker corridor" if any("locker" in t.lower() for t in labs) else f"Corridor {i + 1}"
            if any(r["name"] == nm for r in rooms): nm = f"{nm} {i + 1}"
            rooms.append({"name": nm, "poly": poly, "box": [min(xs), min(ys), max(xs), max(ys)], "floor": "carpet", "kind": "corridor", "slug": slug(nm), "labels": labs})
    names = {r["name"] for r in rooms}
    for r in L["extra_rooms"]:
        if r["name"] in names: continue           # already a room (newer layouts list washrooms in both)
        r = dict(r); x0, y0, x1, y1 = r["box"]; r.setdefault("poly", [[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
        r.setdefault("floor", "tile"); r["slug"] = slug(r["name"]); rooms.append(r)
    L["rooms_all"] = rooms
    glass = []
    for g in L["glass"]:
        if isinstance(g, dict):
            a, b = g.get("a") or g["p0"], g.get("b") or g["p1"]; glass.append([a[0], a[1], b[0], b[1], g.get("layer", "GLASS")])
        else: glass.append(list(g) + (["GLASS"] if len(g) == 4 else []))
    L["glass"] = glass
    for d in L["desks"]: d.setdefault("h", L["heights"]["desk"]); d.setdefault("kind", "desk"); d.setdefault("block", d["kind"])
    for s in L["seats"]: s.setdefault("block", s.get("kind", "seat")); s.setdefault("face", 0.0)
    for d in L["doors"]:
        d.setdefault("d", 0.04); d.setdefault("block", "door")
        op = d.get("opening")
        if isinstance(op, (list, tuple)) and len(op) == 4:      # the CAD pipeline's own wall opening: [x0, y0, x1, y1]
            d["_cad_opening"] = [(op[0] + op[2]) / 2, (op[1] + op[3]) / 2, math.atan2(op[3] - op[1], op[2] - op[0]), math.hypot(op[2] - op[0], op[3] - op[1])]
    L["closures"] = L.get("closures") or []
    for l in L["lights"]: l.setdefault("kind", "downlight")
    return L


def room_kind(style, name, layout_kind=None):
    for rule in style.get("room_kinds", []):
        if re.search(rule["match"], name, re.I): return rule["kind"]
    return layout_kind or "default"


# ------------------------------------------------------------------ floor partition raster (rooms never overlap)
class Raster:
    """The floor plate on a grid. Each cell belongs to exactly one room: where room outlines overlap, the smaller
    room wins. Cells on the floor but in no room belong to a pseudo room 'Circulation'. Used for ceilings, floor
    finishes, occupancy and cameras so neighbouring pieces never overlap (no coplanar faces, no z-fighting)."""
    def __init__(self, L, res=0.025):
        xs = [p[0] for f in L["floor"] for p in f["outer"]]; ys = [p[1] for f in L["floor"] for p in f["outer"]]
        self.x0, self.y0 = min(xs) - 0.5, min(ys) - 0.5; self.res = res
        self.nx = int((max(xs) + 0.5 - self.x0) / res) + 1; self.ny = int((max(ys) + 0.5 - self.y0) / res) + 1
        gx = self.x0 + (np.arange(self.nx) + 0.5) * res; gy = self.y0 + (np.arange(self.ny) + 0.5) * res
        self.X, self.Y = np.meshgrid(gx, gy)
        self.floor = np.zeros(self.X.shape, bool)
        for f in L["floor"]:
            m = self.pip_box(f["outer"])
            for h in f["holes"]: m &= ~self.pip_box(h)
            self.floor |= m
        if L.get("atrium"): self.floor &= ~pip(self.X, self.Y, L["atrium"])
        rooms = L["rooms_all"]
        self.rooms = list(rooms) + [{"name": "Circulation", "slug": "circulation", "floor": "carpet", "poly": None, "box": None}]
        self.label = np.full(self.X.shape, -1, np.int32)
        areas = []
        for r in rooms:
            p = r["poly"]; a = 0.0
            for i in range(len(p)): a += p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1]
            areas.append(abs(a) / 2)
        for i in sorted(range(len(rooms)), key=lambda i: -areas[i]):
            m = self.pip_box(rooms[i]["poly"]) & self.floor; self.label[m] = i
        self.label[(self.label < 0) & self.floor] = len(rooms)
    def pip_box(self, poly):
        """pip() over the whole grid, evaluated only inside the polygon's bounding box (same cells, much faster on a
        large plate: a 6,000 m2 floor is 27 million cells)."""
        out = np.zeros(self.X.shape, bool)
        xs = [p[0] for p in poly]; ys = [p[1] for p in poly]
        j0, j1 = max(0, int((min(xs) - self.x0) / self.res) - 1), min(self.nx, int((max(xs) - self.x0) / self.res) + 2)
        i0, i1 = max(0, int((min(ys) - self.y0) / self.res) - 1), min(self.ny, int((max(ys) - self.y0) / self.res) + 2)
        if j1 > j0 and i1 > i0: out[i0:i1, j0:j1] = pip(self.X[i0:i1, j0:j1], self.Y[i0:i1, j0:j1], poly)
        return out
    def ij(self, x, y):
        return int((y - self.y0) / self.res), int((x - self.x0) / self.res)
    def room_at(self, x, y):
        i, j = self.ij(x, y)
        if 0 <= i < self.ny and 0 <= j < self.nx and self.label[i, j] >= 0: return self.rooms[self.label[i, j]]
        return None
    def rects(self, mask):
        """Greedy decomposition of a cell mask into axis-aligned rectangles (x0, y0, x1, y1) in metres."""
        out = []; open_ = {}
        for i in range(self.ny + 1):
            runs = set()
            if i < self.ny:
                row = mask[i]
                if row.any():
                    d = np.diff(np.concatenate([[0], row.astype(np.int8), [0]]))
                    st = np.where(d == 1)[0]; en = np.where(d == -1)[0]; runs = set(zip(st.tolist(), en.tolist()))
            for k in list(open_):
                if k not in runs:
                    i0 = open_.pop(k); out.append((self.x0 + k[0] * self.res, self.y0 + i0 * self.res, self.x0 + k[1] * self.res, self.y0 + i * self.res))
            for k in runs:
                if k not in open_: open_[k] = i
        return out


# ------------------------------------------------------------------ procedural image textures (numpy, tileable)
def tnoise(n, cells, rng, octaves=4, persistence=0.5):
    """Tileable value noise, n x n, values 0..1."""
    out = np.zeros((n, n), np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        c = cells * (2 ** o)
        if c > n: break
        g = rng.random((c, c)).astype(np.float32)
        t = (np.arange(n) + 0.5) * c / n - 0.5; i0 = np.floor(t).astype(int); f = t - i0; f = f * f * (3 - 2 * f)
        a0 = i0 % c; a1 = (i0 + 1) % c
        rows = g[a0][:, a0] * (1 - f)[None, :] + g[a0][:, a1] * f[None, :]
        rows1 = g[a1][:, a0] * (1 - f)[None, :] + g[a1][:, a1] * f[None, :]
        out += amp * (rows * (1 - f)[:, None] + rows1 * f[:, None]); tot += amp; amp *= persistence
    return out / tot

def stretch_noise(n, cx, cy, rng, octaves=4):
    """Anisotropic tileable noise: cx cells across x, cy along y (cx >> cy makes streaks along y)."""
    out = np.zeros((n, n), np.float32); amp = 1.0; tot = 0.0
    for o in range(octaves):
        ax, ay = cx * 2 ** o, cy * 2 ** o
        if ax > n: break
        g = rng.random((ay, ax)).astype(np.float32)
        def axis(c):
            t = (np.arange(n) + 0.5) * c / n - 0.5; i0 = np.floor(t).astype(int); f = t - i0; f = f * f * (3 - 2 * f); return i0 % c, (i0 + 1) % c, f
        xa, xb, fx = axis(ax); ya, yb, fy = axis(ay)
        r0 = g[ya][:, xa] * (1 - fx) + g[ya][:, xb] * fx; r1 = g[yb][:, xa] * (1 - fx) + g[yb][:, xb] * fx
        out += amp * (r0 * (1 - fy)[:, None] + r1 * fy[:, None]); tot += amp; amp *= 0.5
    return out / tot

def ramp_img(v, colors):
    cs = np.stack([srgb_arr(c) for c in colors]); k = len(cs) - 1
    t = np.clip(v, 0, 1) * k; i = np.clip(np.floor(t).astype(int), 0, k - 1); f = (t - i)[..., None]
    return cs[i] * (1 - f) + cs[i + 1] * f

def gen_texture(spec, n, seed):
    """Returns (rgb float array n x n x 3 in sRGB 0..1, period in metres)."""
    rng = np.random.default_rng(seed); kind = spec["kind"]; cols = spec.get("colors") or [spec.get("color", "#808080")] * 2
    if len(cols) == 1: cols = cols * 2
    if kind == "carpet":
        tw, th = spec.get("tile", [0.6, 0.6]); reps = spec.get("tiles_per_texture", 4)
        if spec.get("pattern") == "plank": tw, th = spec.get("plank", [0.25, 1.0])
        P = max(tw, th) * reps; img = np.zeros((n, n), np.float32); yy, xx = np.mgrid[0:n, 0:n] * (P / n)
        ny_, nx_ = int(round(P / th)), int(round(P / tw))
        stag = (np.floor(yy / th).astype(int) % 2) * (0.5 * tw if spec.get("pattern") == "plank" else 0.0)
        ti = np.floor(((xx + stag) % P) / tw).astype(int) % nx_; tj = np.floor(yy / th).astype(int) % ny_
        tone = rng.normal(0, 1, (ny_, nx_)) * spec.get("tile_tone", 0.06)
        turn = (ti + tj) % 2 if spec.get("pattern") != "plank" else np.zeros_like(ti)       # quarter-turned tiles
        sx = stretch_noise(n, 96, 8, rng, 3); sy = stretch_noise(n, 8, 96, rng, 3).T.copy()
        streak = np.where(turn == 0, sy if spec.get("pattern") == "plank" else sx, sy)
        fine = tnoise(n, 128, rng, 2); blot = tnoise(n, 3, rng, 3)
        if spec.get("streak_threshold") is not None:     # opt-in (Altruist): a dark ground with sparse light streaks, no blotches
            th_ = spec["streak_threshold"]; sk = np.clip((streak - th_) / max(1e-3, 1 - th_), 0, 1) ** spec.get("streak_gamma", 1.5)
            v = 0.18 + spec.get("streak_amp", 0.6) * sk + spec.get("fine_amp", 0.12) * (fine - 0.5) + spec.get("blot_amp", 0.04) * (blot - 0.5) + tone[tj, ti]
        else:
            v = 0.5 + 0.55 * (streak - 0.5) + 0.25 * (fine - 0.5) + 0.25 * (blot - 0.5) + tone[tj, ti]
        fx = ((xx + stag) % tw) / tw; fy = (yy % th) / th; seam = (np.minimum(np.minimum(fx, 1 - fx) * tw, np.minimum(fy, 1 - fy) * th) < 0.0015)
        v = np.where(seam, v - spec.get("seam_depth", 0.12), v)
        return ramp_img(v, cols), P
    if kind in ("fabric", "felt") and spec.get("weave"):     # opt-in: a woven fabric at true scale (threads ~1.5 mm, slubs, a soft mottle)
        P = spec.get("period", 0.2); yy, xx = np.mgrid[0:n, 0:n] * (P / n); pt = spec.get("thread", 0.0015)
        w = 0.5 + 0.5 * np.sin(2 * np.pi * xx / pt) * np.sin(2 * np.pi * yy / pt)
        slub = stretch_noise(n, 64, 6, rng, 3); mott = tnoise(n, 4, rng, 3)
        v = 0.5 + spec.get('weave_amp', 0.22) * (w - 0.5) + spec.get('slub_amp', 0.18) * (slub - 0.5) + spec.get('mottle_amp', 0.12) * (mott - 0.5)
        return ramp_img(v, cols), P
    if kind == "wood":
        pw = spec.get("plank_width", 0.19); P = spec.get("period", pw * 6); g = stretch_noise(n, 4, 48, rng, 4).T
        rows = np.floor(np.mgrid[0:n, 0:n][0] * (P / n) / pw).astype(int)
        tone = rng.normal(0, 1, rows.max() + 1) * 0.08
        v = 0.5 + 0.8 * (g - 0.5) + tone[rows] + 0.15 * (tnoise(n, 6, rng, 3) - 0.5)
        if spec.get("planks", True):
            fy = (np.mgrid[0:n, 0:n][0] * (P / n)) % pw; v = np.where(fy < 0.0012, v - 0.25, v)
        return ramp_img(v, cols), P
    if kind == "terrazzo":
        P = spec.get("period", 1.2); img = ramp_img(0.5 + 0.2 * (tnoise(n, 8, rng, 4) - 0.5), [cols[0], cols[0]])
        chips = spec.get("chips", ["#8a8a88", "#d9d4ca", "#3c3c3c", "#b78f6a"]); yy, xx = np.mgrid[0:n, 0:n]
        for _ in range(int(spec.get("density", 1400) * (P / 1.2) ** 2)):
            cx, cy = rng.random(2) * n; r = (rng.random() ** 2 * 0.012 + 0.002) / P * n
            x0, x1, y0, y1 = int(cx - r - 1), int(cx + r + 2), int(cy - r - 1), int(cy + r + 2)
            sl = (slice(max(0, y0), min(n, y1)), slice(max(0, x0), min(n, x1)))
            m = ((xx[sl] - cx) ** 2 * rng.uniform(0.6, 1.4) + (yy[sl] - cy) ** 2) < r * r
            img[sl][m] = srgb_arr(chips[rng.integers(len(chips))]) * rng.uniform(0.85, 1.1)
        return np.clip(img, 0, 1), P
    if kind in ("stone", "tile", "ceiling_tile"):
        ts = spec.get("tile", [0.6, 0.6]); reps = spec.get("tiles_per_texture", 2); P = max(ts) * reps
        v = 0.5 + 0.3 * (tnoise(n, 6, rng, 5) - 0.5)
        if kind == "stone": v += 0.25 * (np.abs(np.sin(tnoise(n, 3, rng, 4) * 18.0)) < 0.08)
        if kind == "ceiling_tile": v += 0.25 * (tnoise(n, 160, rng, 2) - 0.5)
        yy, xx = np.mgrid[0:n, 0:n] * (P / n); fx = xx % ts[0]; fy = yy % ts[1]
        joint = (np.minimum(np.minimum(fx, ts[0] - fx), np.minimum(fy, ts[1] - fy)) < spec.get("joint", 0.0015))
        img = ramp_img(v, cols); jc = srgb_arr(spec.get("joint_color", cols[0])) * 0.82
        img[joint] = jc
        return img, P
    raise ValueError(kind)


# ------------------------------------------------------------------ materials from style.json
def N(nt, kind, loc=(0, 0), **props):
    n = nt.nodes.new(kind); n.location = loc
    for k, v in props.items(): setattr(n, k, v)
    return n

def setin(node, names, v):
    for nm in names:
        if nm in node.inputs: node.inputs[nm].default_value = v; return True
    return False

class Materials:
    """Builds bpy materials lazily from style['materials'][name]. Image-textured kinds (carpet, wood, terrazzo,
    stone, tile, ceiling_tile) use generated PNGs on the metre-scaled 'UVMap', so they read at true scale in Cycles
    and export to glTF unchanged. Roughness variation and bump are Blender-only extras (ignored by the exporter)."""
    def __init__(self, style, texdir, wb_k=4150.0, tex_res=1024):
        self.S = style.get("materials", {}); self.texdir = texdir; self.wb = wb_k; self.res = min(2048, tex_res)
        self.cache = {}; self.missing = set(); self.parts = {}
        for part, names in style.get("parts", {}).items():
            for nm in names: self.parts[nm] = part
        os.makedirs(texdir, exist_ok=True)
    def get(self, name):
        if name in self.cache: return self.cache[name]
        spec = self.S.get(name)
        if spec is None:
            self.missing.add(name); spec = {"kind": "plain", "color": "#9a9a9a", "rough": 0.6}
        if isinstance(spec, str): spec = self.S[spec]   # alias
        m = self.build(name, spec); self.cache[name] = m; return m
    def build(self, name, s):
        m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree
        b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"); out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
        k = s.get("kind", "plain"); col = s.get("color", (s.get("colors") or ["#9a9a9a"])[0])
        setin(b, ["Base Color"], (*lin(col), 1)); setin(b, ["Roughness"], s.get("rough", 0.5)); setin(b, ["Metallic"], 1.0 if k == "metal" else s.get("metal", 0.0))
        if s.get("coat"): setin(b, ["Coat Weight"], s["coat"])
        if s.get("sheen") or k in ("fabric", "felt"): setin(b, ["Sheen Weight"], s.get("sheen", 0.4))
        m["twin_kind"] = k
        if k in ("carpet", "wood", "terrazzo", "stone", "tile", "ceiling_tile") or (k in ("fabric", "felt") and s.get("weave")):
            self.image_base(m, nt, b, name, s)
        if s.get("maps"):          # opt-in: scanned normal / roughness maps (CC0), tiled at their real size; replaces the noise bump
            self.real_maps(nt, b, s["maps"])
        elif k in ("paint", "fabric", "felt", "plain", "plastic", "metal", "carpet", "wood", "stone", "terrazzo", "tile", "ceiling_tile"):
            self.rough_vary(nt, b, s.get("rough", 0.5), s.get("vary", 0.18), s.get("vscale", 2.5))
            bump_amt = {"carpet": 0.5, "fabric": 0.35, "felt": 0.5, "paint": 0.08, "wood": 0.08, "stone": 0.05}.get(k, 0.0)
            if bump_amt and not s.get("maps"): self.bump(nt, b, s.get("bump", bump_amt), s.get("bump_scale", 700 if k in ("carpet", "felt", "fabric") else 250))
        if k == "glass":
            setin(b, ["Roughness"], s.get("rough", 0.0)); setin(b, ["Transmission Weight"], 1.0); setin(b, ["IOR"], s.get("ior", 1.5))
            lp = N(nt, "ShaderNodeLightPath", (0, 300)); tr = N(nt, "ShaderNodeBsdfTransparent", (0, 150)); mx = N(nt, "ShaderNodeMixShader", (250, 200))
            tr.inputs["Color"].default_value = (*[min(1, 0.1 + c) for c in lin(col)], 1)
            nt.links.new(lp.outputs["Is Shadow Ray"], mx.inputs["Fac"]); nt.links.new(b.outputs["BSDF"], mx.inputs[1]); nt.links.new(tr.outputs["BSDF"], mx.inputs[2]); nt.links.new(mx.outputs["Shader"], out.inputs["Surface"])
            setin(b, ["Alpha"], s.get("alpha", 0.25))      # glTF reads alpha; Cycles uses the mix above
        if k == "frost":
            setin(b, ["Roughness"], s.get("rough", 0.45)); setin(b, ["Transmission Weight"], 0.7); setin(b, ["Alpha"], s.get("alpha", 0.75))
            setin(b, ["Subsurface Weight"], 0.0)
            tl = N(nt, "ShaderNodeBsdfTranslucent", (0, 150)); tl.inputs["Color"].default_value = (*lin(col), 1)
            mx = N(nt, "ShaderNodeMixShader", (250, 200)); mx.inputs[0].default_value = s.get("translucency", 0.16)
            nt.links.new(b.outputs["BSDF"], mx.inputs[1]); nt.links.new(tl.outputs["BSDF"], mx.inputs[2]); nt.links.new(mx.outputs["Shader"], out.inputs["Surface"])
            try: m.surface_render_method = "BLENDED"
            except Exception: pass
        if k == "emission":
            c = light_col(s["kelvin"], self.wb) if "kelvin" in s else lin(col)
            setin(b, ["Base Color"], (*c, 1)); setin(b, ["Emission Color"], (*c, 1)); setin(b, ["Emission Strength"], s.get("strength", 10.0))
        if k == "screen":
            setin(b, ["Base Color"], (0.005, 0.005, 0.006, 1)); setin(b, ["Roughness"], 0.15); setin(b, ["Coat Weight"], 0.6)
            setin(b, ["Emission Color"], (*lin(s.get("glow", "#33566a")), 1)); setin(b, ["Emission Strength"], s.get("strength", 0.7))
        if k == "leaf":
            g = N(nt, "ShaderNodeNewGeometry", (-900, 0)); nz = N(nt, "ShaderNodeTexNoise", (-720, 0)); nz.inputs["Scale"].default_value = 9.0
            nt.links.new(g.outputs["Position"], nz.inputs["Vector"])
            rp = N(nt, "ShaderNodeValToRGB", (-500, 0)); e = rp.color_ramp.elements; e[0].position = 0.3; e[0].color = (*lin(s.get("dark", "#163f1c")), 1); e[1].position = 0.75; e[1].color = (*lin(col), 1)
            nt.links.new(nz.outputs["Fac"], rp.inputs["Fac"]); nt.links.new(rp.outputs["Color"], b.inputs["Base Color"]); setin(b, ["Roughness"], 0.35)
            tr = N(nt, "ShaderNodeBsdfTranslucent", (0, 150)); nt.links.new(rp.outputs["Color"], tr.inputs["Color"])
            mx = N(nt, "ShaderNodeMixShader", (250, 200)); mx.inputs[0].default_value = 0.22
            nt.links.new(b.outputs["BSDF"], mx.inputs[1]); nt.links.new(tr.outputs["BSDF"], mx.inputs[2]); nt.links.new(mx.outputs["Shader"], out.inputs["Surface"])
        if k == "image":
            p = s.get("image", "")
            if p and not os.path.isabs(p): p = os.path.join(HERE, p)
            if p and os.path.exists(p):
                im = bpy.data.images.load(p, check_existing=True); tx = N(nt, "ShaderNodeTexImage", (-400, 200)); tx.image = im
                uv = N(nt, "ShaderNodeUVMap", (-600, 200)); uv.uv_map = "UVMap"; nt.links.new(uv.outputs[0], tx.inputs[0])
                nt.links.new(tx.outputs["Color"], b.inputs["Base Color"]); nt.links.new(tx.outputs["Alpha"], b.inputs["Alpha"])
                try: m.surface_render_method = "BLENDED"
                except Exception: pass
                if s.get("emit"): nt.links.new(tx.outputs["Color"], b.inputs["Emission Color"]); setin(b, ["Emission Strength"], s["emit"])
            else: m["twin_missing_image"] = p
        if k == "plain" and s.get("emit"):
            setin(b, ["Emission Color"], (*lin(col), 1)); setin(b, ["Emission Strength"], s["emit"])
        if name in self.parts: m.pass_index = sorted(set(self.parts.values())).index(self.parts[name]) + 1
        return m
    def image_base(self, m, nt, b, name, s):
        key = hashlib.md5(json.dumps(s, sort_keys=True).encode()).hexdigest()[:8]; path = os.path.join(self.texdir, f"{tok(name)}_{key}.png")
        P = None
        meta = path + ".json"
        if os.path.exists(path) and os.path.exists(meta): P = json.load(open(meta))["period"]
        else:
            rgb, P = gen_texture(s, self.res, int(key, 16) % 10000)
            img = bpy.data.images.new(f"tex_{name}", self.res, self.res, alpha=False)
            px = np.ones((self.res, self.res, 4), np.float32); px[..., :3] = np.clip(rgb, 0, 1)
            img.pixels.foreach_set(px.ravel()); img.filepath_raw = path; img.file_format = "PNG"; img.save(); bpy.data.images.remove(img)
            json.dump({"period": P}, open(meta, "w"))
        im = bpy.data.images.load(path, check_existing=True)
        uv = N(nt, "ShaderNodeUVMap", (-900, 300)); uv.uv_map = "UVMap"
        mp = N(nt, "ShaderNodeMapping", (-720, 300)); mp.inputs["Scale"].default_value = (1 / P, 1 / P, 1)
        tx = N(nt, "ShaderNodeTexImage", (-520, 300)); tx.image = im; tx.interpolation = "Cubic"
        nt.links.new(uv.outputs[0], mp.inputs[0]); nt.links.new(mp.outputs[0], tx.inputs[0]); nt.links.new(tx.outputs["Color"], b.inputs["Base Color"])
        m["twin_period"] = P
    def rough_vary(self, nt, b, rough, vary, vscale):
        if not vary or b.inputs["Roughness"].is_linked: return
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
    def real_maps(self, nt, b, mp_):
        P = mp_.get("size_m", 0.5); uv = N(nt, "ShaderNodeUVMap", (-1100, -600)); uv.uv_map = "UVMap"
        mp = N(nt, "ShaderNodeMapping", (-950, -600)); mp.inputs["Scale"].default_value = (1 / P, 1 / P, 1); nt.links.new(uv.outputs[0], mp.inputs["Vector"])
        def tex(path, non_color=True):
            path = path if os.path.isabs(path) else os.path.join(HERE, path)
            t = N(nt, "ShaderNodeTexImage", (-760, -600)); t.image = bpy.data.images.load(path, check_existing=True)
            if non_color: t.image.colorspace_settings.name = "Non-Color"
            nt.links.new(mp.outputs["Vector"], t.inputs["Vector"]); return t
        if mp_.get("normal"):
            nm = N(nt, "ShaderNodeNormalMap", (-400, -600)); nm.inputs["Strength"].default_value = mp_.get("normal_strength", 1.0)
            nt.links.new(tex(mp_["normal"]).outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
        if mp_.get("rough"):
            mr = N(nt, "ShaderNodeMath", (-400, -800)); mr.operation = "MULTIPLY_ADD"; mr.inputs[1].default_value = mp_.get("rough_gain", 1.0); mr.inputs[2].default_value = mp_.get("rough_bias", 0.0)
            nt.links.new(tex(mp_["rough"]).outputs["Color"], mr.inputs[0]); nt.links.new(mr.outputs[0], b.inputs["Roughness"])

    def bump(self, nt, b, strength, scale):
        g = N(nt, "ShaderNodeNewGeometry", (-900, -900)); n = N(nt, "ShaderNodeTexNoise", (-720, -900)); n.inputs["Scale"].default_value = scale
        nt.links.new(g.outputs["Position"], n.inputs["Vector"])
        bp = N(nt, "ShaderNodeBump", (-200, -300)); bp.inputs["Strength"].default_value = strength; bp.inputs["Distance"].default_value = 0.002
        nt.links.new(n.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])


# ------------------------------------------------------------------ mesh building: one mesh per CAD block, many materials
WELD_MAX_FACES = None        # set by build_floor.py from the style

class MB:
    """Accumulates parts (each with its own material) and makes ONE mesh. Parts never share vertices, so weighted
    normals stay per part. UVs are box-projected in metres unless the part gives its own."""
    def __init__(self, mats):
        self.mats = mats; self.v = []; self.f = []; self.fm = []; self.names = []; self.uv = {}; self.smooth = []
    def mi(self, name):
        if name not in self.names: self.names.append(name)
        return self.names.index(name)
    def add(self, verts, faces, mat, M=None, smooth=False, uvs=None):
        k = len(self.v); m = self.mi(mat)
        for p in verts: self.v.append(tuple(M @ Vector(p)) if M is not None else tuple(p))
        for fi, fc in enumerate(faces):
            self.f.append(tuple(i + k for i in fc)); self.fm.append(m); self.smooth.append(smooth)
            if uvs is not None: self.uv[len(self.f) - 1] = [uvs[i] for i in fc]
    def add_bm(self, bm, mat, M=None, smooth=False):
        bm.verts.index_update(); vs = [tuple(v.co) for v in bm.verts]; fs = [tuple(v.index for v in f.verts) for f in bm.faces]
        self.add(vs, fs, mat, M, smooth)
    def box(self, w, d, h, M, mat, bevel=0.0, center_z=False):
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts: v.co = Vector((v.co.x * w, v.co.y * d, v.co.z * h + (0 if center_z else h / 2)))
        if bevel > 0:
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, w / 2.2, d / 2.2, h / 2.2), segments=2, profile=0.5, affect="EDGES")
        self.add_bm(bm, mat, M, smooth=bevel > 0); bm.free()
    def cyl(self, r, h, M, mat, seg=24, r2=None):
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
        for v in bm.verts: v.co.z += h / 2
        self.add_bm(bm, mat, M, smooth=True); bm.free()
    def lathe(self, profile, M, mat, seg=28):
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
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); self.add_bm(bm, mat, M, smooth=True); bm.free()
    def rod(self, p0, p1, r0, r1, mat, M=None, seg=10):
        d = Vector(p1) - Vector(p0); R = Matrix.Translation(p0) @ Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
        self.cyl(r0, d.length, (M @ R) if M is not None else R, mat, seg, r1)
    def prism(self, outer, z0, z1, mat, M=None, holes=(), bevel=0.0, ends=False):
        loops = [outer] + list(holes); pts = [p for l in loops for p in l]; n = len(pts)
        tris = tessellate_polygon([[Vector((x, y, 0)) for x, y in l] for l in loops])
        vs = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
        fs = [tuple(reversed(t)) for t in tris] + [tuple(i + n for i in t) for t in tris]; k = 0
        for l in loops:
            m = len(l)
            for i in range(m): a, b = k + i, k + (i + 1) % m; fs.append((a, b, b + n, a + n))
            k += m
        bm = bmesh.new()
        for v in vs: bm.verts.new(v)
        bm.verts.ensure_lookup_table()
        for f in fs:
            try: bm.faces.new([bm.verts[i] for i in f])
            except ValueError: pass
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        if bevel > 0: bevel_bm(bm, bevel, (z0, z1) if ends else None)
        self.add_bm(bm, mat, M, smooth=bevel > 0); bm.free()
    def quad(self, x0, y0, x1, y1, z, mat, down=False):
        f = (0, 3, 2, 1) if down else (0, 1, 2, 3); self.add([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [f], mat)
    def empty(self): return not self.f
    def build(self, name, normals=True):
        me = bpy.data.meshes.new(name); me.from_pydata(self.v, [], self.f); me.validate(clean_customdata=False); me.update()
        if getattr(self, "weld", False) and WELD_MAX_FACES and len(self.f) > WELD_MAX_FACES:
            self.weld = False          # opt-in cap (style 'weld_max_faces'): a huge grid stays a connected quad grid (no slivers, no
                                       # cracks), because dissolving 100k quads is quadratic in Blender; the GLB export merges it anyway
        if getattr(self, "weld", False):        # grid surfaces: dissolve the coplanar grid into a few big faces
            for nm in self.names: me.materials.append(self.mats.get(nm))
            if len(me.polygons) == len(self.fm): me.polygons.foreach_set("material_index", self.fm)
            bm = bmesh.new(); bm.from_mesh(me)
            bmesh.ops.dissolve_limit(bm, angle_limit=0.0017, use_dissolve_boundaries=False, verts=bm.verts[:], edges=bm.edges[:], delimit={"MATERIAL"})
            bm.to_mesh(me); bm.free(); box_uv(me); return me
        for nm in self.names: me.materials.append(self.mats.get(nm))
        if len(me.polygons) == len(self.fm):
            me.polygons.foreach_set("material_index", self.fm); me.polygons.foreach_set("use_smooth", self.smooth)
        box_uv(me, self.uv if len(me.polygons) == len(self.fm) else {})
        if normals and any(self.smooth): weighted_normals(me)
        return me

def bevel_bm(bm, width, ends=None, segs=2):
    es = []
    for e in bm.edges:
        if len(e.link_faces) != 2 or not e.is_convex or e.calc_face_angle(0.0) < 0.6: continue
        a, b = e.verts
        if ends and any(abs(a.co.z - z) < 1e-4 and abs(b.co.z - z) < 1e-4 for z in ends): continue
        es.append(e)
    if es:
        try: bmesh.ops.bevel(bm, geom=es, offset=width, segments=segs, profile=0.5, affect="EDGES", clamp_overlap=True)
        except Exception as ex: print("bevel skipped:", ex)

def box_uv(me, given=None):
    """UVMap in metres: each face projected along its dominant axis. 1 UV unit = 1 m, so a 600 mm carpet tile is
    600 mm whatever the object's size. Faces with explicit UVs keep them."""
    lay = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    nrm = np.empty(len(me.polygons) * 3, np.float32); me.polygons.foreach_get("normal", nrm); nrm = np.abs(nrm.reshape(-1, 3))
    ls = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get("loop_start", ls)
    lt = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get("loop_total", lt)
    lv = np.empty(len(me.loops), np.int32); me.loops.foreach_get("vertex_index", lv)
    ax = np.argmax(nrm, axis=1); poly_of_loop = np.repeat(np.arange(len(me.polygons)), lt)
    a = ax[poly_of_loop]; p = co[lv]
    u = np.where(a == 0, p[:, 1], p[:, 0]); v = np.where(a == 2, p[:, 1], p[:, 2])
    uv = np.stack([u, v], 1)
    for fi, l in (given or {}).items():
        for k, t in enumerate(l): uv[ls[fi] + k] = t
    lay.data.foreach_set("uv", uv.ravel())

def weighted_normals(me, limit=math.radians(42)):
    me.update()
    around = {}
    for p in me.polygons:
        n = p.normal.copy(); a = p.area
        for vi in p.vertices: around.setdefault(vi, []).append((n, a))
    cl = math.cos(limit); out = []
    for p in me.polygons:
        pn = p.normal
        for vi in p.vertices:
            if not p.use_smooth: out.append(pn.copy()); continue
            acc = Vector((0, 0, 0))
            for n, a in around[vi]:
                if n.dot(pn) > cl: acc += n * a
            out.append(acc.normalized() if acc.length > 1e-12 else pn.copy())
    try: me.normals_split_custom_set(out)
    except Exception: pass


# ------------------------------------------------------------------ object registry: <tenant>_<layer>_<block>_<n>, one collection per layer
class Registry:
    def __init__(self, tenant, root=None):
        self.tenant = tenant; self.count = {}
        self.root = bpy.data.collections.get(tenant) or bpy.data.collections.new(tenant)
        if self.root.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(self.root)
        self.cols = {}
    def col(self, layer):
        if layer not in self.cols:
            name = f"{self.tenant}_{layer}"; c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
            if c.name not in self.root.children: self.root.children.link(c)
            self.cols[layer] = c
        return self.cols[layer]
    def put(self, layer, block, mesh, M=None, props=None):
        key = (layer, tok(block)); self.count[key] = self.count.get(key, 0) + 1
        name = f"{self.tenant}_{layer}_{tok(block)}_{self.count[key]}"
        o = bpy.data.objects.new(name, mesh); self.col(layer).objects.link(o)
        if M is not None: o.matrix_world = M
        o["twin_layer"] = layer; o["twin_block"] = str(block)
        for k, v in (props or {}).items(): o[k] = v
        return o


# ------------------------------------------------------------------ render setup
def setup_cycles(scene, samples, device_pref="gpu", denoise=True):
    scene.render.engine = "CYCLES"; C = scene.cycles; C.samples = samples; C.use_denoising = denoise
    scene.render.use_persistent_data = True      # keep the BVH between renders of the same scene (contact sheets, stills)
    for attr, val in (("denoiser", "OPENIMAGEDENOISE"), ("max_bounces", 10), ("diffuse_bounces", 5), ("glossy_bounces", 4), ("transmission_bounces", 10),
                      ("transparent_max_bounces", 16), ("sample_clamp_indirect", 6.0), ("caustics_reflective", False), ("caustics_refractive", False),
                      ("use_light_tree", True), ("use_adaptive_sampling", True)):
        try: setattr(C, attr, val)
        except Exception: pass
    device = "CPU"
    if device_pref != "cpu":
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = kind; prefs.get_devices()
                devs = [d for d in prefs.devices if d.type == kind]
                if devs:
                    for d in prefs.devices: d.use = d.type == kind
                    C.device = "GPU"; device = f"{kind}: " + ", ".join(d.name for d in devs); break
            except Exception: continue
    try: C.denoising_use_gpu = device != "CPU"
    except Exception: pass
    print(f"Cycles device: {device} (scene.cycles.device = {C.device})", flush=True)
    scene["twin_device"] = device
    return device

def colour_management(scene, exposure, look="AgX - Medium High Contrast"):
    scene.view_settings.view_transform = "AgX"
    for lk in (look, "Medium High Contrast", "None"):
        try: scene.view_settings.look = lk; break
        except Exception: continue
    scene.view_settings.exposure = exposure

def read_png(path):
    """sRGB 8-bit PNG -> float array (h, w, 3) 0..1, top row first."""
    import OpenImageIO as oiio
    inp = oiio.ImageInput.open(path); px = inp.read_image(format=oiio.FLOAT); inp.close()
    return np.asarray(px)[..., :3]

def write_png(path, rgb):
    import OpenImageIO as oiio
    a = np.clip(rgb, 0, 1).astype(np.float32); h, w = a.shape[:2]
    spec = oiio.ImageSpec(w, h, a.shape[2], oiio.UINT8); out = oiio.ImageOutput.create(path); out.open(path, spec); out.write_image(a); out.close()

def exposure_stats(rgb):
    """Fractions of blown (all channels >= 0.98) and crushed (all <= 0.03) pixels in a display-referred image."""
    blown = float(np.mean(np.all(rgb >= 0.98, axis=2))); black = float(np.mean(np.all(rgb <= 0.03, axis=2)))
    return {"blown": round(blown, 4), "black": round(black, 4), "mean": round(float(rgb.mean()), 3)}

def set_cam(cam, pos, yaw, pitch_deg, hfov_deg, aspect=16 / 9):
    """Level camera (no roll, no tilt) looking along yaw; the pitch is made with lens shift so verticals stay vertical."""
    cd = cam.data; cd.sensor_fit = "HORIZONTAL"; cd.sensor_width = 36.0
    cd.lens = 18.0 / math.tan(math.radians(hfov_deg) / 2)
    cd.shift_y = -math.tan(math.radians(pitch_deg)) * cd.lens / cd.sensor_width; cd.shift_x = 0.0
    cam.location = pos; cam.rotation_euler = (math.pi / 2, 0.0, yaw - math.pi / 2)
