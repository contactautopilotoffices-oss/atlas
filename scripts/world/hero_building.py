"""A modelled office building and its plot, for the 3D explorer (one per option, driven by a spec file).

  python scripts/world/hero_building.py SPECS.json OPTION SCENE.json TEX_DIR OUT.glb [--render OUT_PREFIX] [--fast] [--blend OUT.blend]

  SPECS.json   e.g. scripts/world/heroes/noida_jindalx.json: per option, the workbook facts (floors, grade,
               stilt or lobby ground floor, a smaller upper block) and the design assumptions, each listed
  OPTION       the option id (magnus-towers, a104, ...); its footprint is the plot massing in the spec's refs file
  SCENE.json   the region scene from prep.py (roads, buildings, ground and floor heights)
  TEX_DIR      the texture folder (scripts/world/hero_textures.py), for the Blender materials and renders

Writes:
  OUT.glb            the building and its site in the scene's own metres, merged into one mesh with one
                     primitive per material (OUT.glb.frame.json is C = [0, 0], phi = 0 for diorama.py --exterior)
  OUT.glb.site.json  the plot, typed tree positions, the entrance, a street camera and, for a stepped
                     building, the upper block's footprint (diorama.py --site)
  --blend            an editable .blend, organised into the asset collections below, with the cameras
  --render           Cycles stills from those cameras (property, closeup, street, landscape)

The Blender scene is organised into the asset collections used across Autopilot's property models:
  Architecture, Building_Facades, Windows_And_Balconies, Rooftops, Vegetation, Landscaping, Amenities,
  Street_Infrastructure, Materials, Lighting_And_Cameras
Amenities stays empty unless the spec lists amenities that the property is known to have: nothing is
invented (no pool, courts or clubhouse unless the workbook or the landlord says so).

Two building families, following the repository's convention (scripts/world/README.md):
  Grade A   curtain wall with spandrels and slab bands, stone colonnade, double-height entrance, fins
  Grade B   painted plaster with ribbon windows, sunshades (chajjas) and pilasters; a stilt or a lobby ground
            floor; split AC units on older blocks; an optional set-back upper block (for "+2 floors of 8k")
"""
import sys, os, json, math, random
import numpy as np
import shapely
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union

A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
SPECS, OID, SCENE, TEX, OUT = A[0], A[1], A[2], A[3], A[4]
RENDER = A[A.index("--render") + 1] if "--render" in A else None
BLEND = A[A.index("--blend") + 1] if "--blend" in A else None
FAST = "--fast" in A
SPALL = json.load(open(SPECS)); SP = SPALL[OID]
RND = random.Random(SP.get("seed", 1))
SQFT = 0.09290304

S = json.load(open(SCENE))
REFS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), SPALL.get("refs", "refs/noida_jindalx.json"))))
foot = Polygon(REFS[OID]["poly"]).buffer(0)
FAM = SP["facade"]
LEGACY = FAM in ("curtain", "banded")        # the two original families; every other family is spec-driven (see the level engine below)
GH, FH, NF = SP.get("ground_h", S.get("ground_h", 5.0)), SP.get("floor_h", S.get("floor_h", 4.0)), int(SP["floors"])
H = GH + NF * FH            # top of the roof slab
PAR = 1.4 if SP["grade"] == "A" else 1.2
GRADE_A = FAM == "curtain"
VUP = not LEGACY            # new families: UV v runs UP the wall in metres (an upright texture stays upright in Blender and in glTF)
REF = REFS[OID]
UPPER = SP.get("upper")     # {"from": floor number, "sqft": plate}: floors from..NF on a smaller block at the back
HF = GH + (UPPER["from"] - 1) * FH if UPPER else H     # top of the full-plate block

# ------------------------------------------------------------------ the frame: front face = the face nearest a road
roads = unary_union([Polygon(r[0], r[1:]).buffer(0) for k in ("major", "minor") for r in S["roads"][k] if Polygon(r[0]).distance(foot) < 200])
ring = list(foot.exterior.coords)[:-1]
if not Polygon(ring).exterior.is_ccw: ring = ring[::-1]
faces = []
for i in range(len(ring)):
    a, b = np.array(ring[i]), np.array(ring[(i + 1) % len(ring)]); m = (a + b) / 2
    faces.append((roads.distance(Point(*m)), i, a, b))
faces.sort(key=lambda f: f[0])
if REF.get("front_toward"):    # the face whose middle is nearest this scene point is the front (entrance side), whatever the roads say
    _ft = Point(*REF["front_toward"]); faces.sort(key=lambda f: Point(*((f[2] + f[3]) / 2)).distance(_ft))
_, fi, FA, FB = faces[0]
U = (FB - FA) / np.linalg.norm(FB - FA)          # along the front face (local +x)
NIN = np.array([-U[1], U[0]])                    # into the building from the front (local +y): left of a ccw edge
C = np.array(foot.centroid.coords[0])
W = float(np.linalg.norm(FB - FA)); D = float(max(abs(np.dot(np.array(p) - C, NIN)) for p in ring) * 2)
def T(x, y): p = C + U * x + NIN * y; return float(p[0]), float(p[1])
def Tinv(px, py): d = np.array([px, py]) - C; return float(np.dot(d, U)), float(np.dot(d, NIN))
YF, YB = -D / 2, D / 2       # front face (road side) and back face in local y
print(f"{OID}: front {W:.1f} m, depth {D:.1f} m, front face {fi}, road {faces[0][0]:.1f} m away, G+{NF}, top {H:.1f} m")

# ------------------------------------------------------------------ geometry accumulator (local frame), per collection and material
TILE = {"hero_glass": (6.0, 8.0), "hero_alu": (2.4, 2.4), "hero_stone": (2.4, 2.4), "hero_concrete": (4.8, 4.8), "hero_roof": (4.0, 4.0),
        "hero_pavers": (2.0, 2.0), "hero_asphalt": (4.0, 4.0), "hero_lawn": (4.0, 4.0), "hero_mulch": (2.0, 2.0), "hero_spandrel": (3.0, 3.0),
        "hero_hedge": (1.5, 1.5), "hero_plaster": (2.4, 2.4), "hero_plaster_b": (2.4, 2.4),
        # the JindalX facade set (real metres one texture tile covers; overridden from TEX/TILES.json when the texture worker has written it)
        "hero_acp_white": (3.0, 3.0), "hero_acp_charcoal": (3.0, 3.0), "hero_acp_copper": (3.0, 3.0), "hero_acp_grey": (3.0, 3.0),
        "hero_glass_dark": (4.0, 4.0), "hero_glass_bluegrey": (4.0, 4.0), "hero_glass_green": (4.0, 4.0), "hero_glass_teal": (4.0, 4.0),
        "hero_plaster_cream": (3.0, 3.0), "hero_plaster_white": (3.0, 3.0), "hero_bark": (1.0, 1.0)}
def _load_tiles():
    """TEX/TILES.json (hero_textures.py): {material: metres | [w, h] | {"w":, "h":} | {"tile_m": ...}}; whatever shape, the tile's real size in metres."""
    pth = os.path.join(TEX, "TILES.json")
    if not os.path.exists(pth): print("TILES.json not found: default tile sizes"); return
    try: J = json.load(open(pth))
    except Exception as e: print("TILES.json unreadable:", e); return
    J = J.get("tiles", J) if isinstance(J, dict) else {}
    for k, v in J.items():
        try:
            if isinstance(v, (int, float)): wh = (float(v), float(v))
            elif isinstance(v, (list, tuple)): wh = (float(v[0]), float(v[1] if len(v) > 1 else v[0]))
            elif isinstance(v, dict):
                w_ = v.get("w", v.get("width", v.get("width_m", v.get("tile_m", v.get("m", v.get("size")))))); h_ = v.get("h", v.get("height", v.get("height_m", w_)))
                if isinstance(w_, (list, tuple)): w_, h_ = w_[0], w_[1]
                wh = (float(w_), float(h_))
            else: continue
            if wh[0] > 0 and wh[1] > 0: TILE[k] = wh
        except Exception: continue
    print("TILES.json read:", {k: TILE[k] for k in TILE if k in J})
_load_tiles()
# storey-aligned glass: one tile per storey (the spandrel band straddles the slab line), the dark curtain tile is two storeys; the tile's origin is the first floor's slab
TILE["hero_glass_bluegrey"] = (TILE["hero_glass_bluegrey"][0], FH); TILE["hero_glass_green"] = (TILE["hero_glass_green"][0], FH); TILE["hero_glass_dark"] = (TILE["hero_glass_dark"][0], 2 * FH)
VORG = {"hero_glass_bluegrey": GH, "hero_glass_green": GH, "hero_glass_dark": GH}
COLLS = ["Architecture", "Building_Facades", "Windows_And_Balconies", "Rooftops", "Vegetation", "Landscaping", "Amenities",
         "Street_Infrastructure", "Materials", "Lighting_And_Cameras"]
WINMATS = {"hero_glass", "hero_mullion", "hero_spandrel", "hero_lobby_glass"}
COLL = "Architecture"
def coll(c): global COLL; COLL = c
G = {}
def grp(m):
    c = "Windows_And_Balconies" if COLL == "Building_Facades" and m in WINMATS else COLL
    return G.setdefault((c, m), {"v": [], "f": [], "uv": []})
def poly3(m, pts, uvs):
    g = grp(m); b = len(g["v"]); g["v"].extend(pts); g["uv"].extend(uvs); g["f"].append(list(range(b, b + len(pts))))
def wall(m, x0, y0, x1, y1, z0, z1, u0=0.0, v_top=None, vo=None):
    """A vertical quad from (x0,y0) to (x1,y1), facing right of the direction of travel; UVs in metres / tile."""
    tw, th = TILE.get(m, (1.0, 1.0)); L = math.hypot(x1 - x0, y1 - y0); vt = z1 if v_top is None else v_top
    if VUP:    # new families: v = metres up from the ground (absolute, so joints line up from one floor to the next); u = metres along the face
        o_ = VORG.get(m, 0.0) if vo is None else vo; a_, b_ = (z0 - o_) / th, (z1 - o_) / th
        poly3(m, [(x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1)], [(u0 / tw, a_), ((u0 + L) / tw, a_), ((u0 + L) / tw, b_), (u0 / tw, b_)]); return
    poly3(m, [(x0, y0, z0), (x1, y1, z0), (x1, y1, z1), (x0, y0, z1)],
          [(u0 / tw, (vt - z0) / th), ((u0 + L) / tw, (vt - z0) / th), ((u0 + L) / tw, (vt - z1) / th), (u0 / tw, (vt - z1) / th)])
def hquad(m, x0, y0, x1, y1, z, up=True):
    tw, th = TILE.get(m, (1.0, 1.0)); pts = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]
    if not up: pts = pts[::-1]
    poly3(m, pts, [(p[0] / tw, p[1] / th) for p in pts])
def bx(m, cx, cy, z0, z1, sx, sy, rot=0.0, top=True, bottom=False, mats=None):
    """An oriented box; mats can give (sides, top) materials."""
    c, s = math.cos(rot), math.sin(rot); hx, hy = sx / 2, sy / 2
    P = [(cx + c * x - s * y, cy + s * x + c * y) for x, y in ((-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy))]
    ms, mt = (mats or (m, m))
    u = 0.0
    for i in range(4):
        (ax, ay), (bx_, by) = P[i], P[(i + 1) % 4]; wall(ms, ax, ay, bx_, by, z0, z1, u); u += math.hypot(bx_ - ax, by - ay)
    tw, th = TILE.get(mt, (1.0, 1.0))
    if top: poly3(mt, [(x, y, z1) for x, y in P], [(x / tw, y / th) for x, y in P])
    if bottom: poly3(mt, [(x, y, z0) for x, y in P[::-1]], [(x / tw, y / th) for x, y in P[::-1]])
def cyl(m, cx, cy, z0, z1, r, n=12, top=True):
    pts = [(cx + r * math.cos(t), cy + r * math.sin(t)) for t in np.linspace(0, math.tau, n, endpoint=False)]
    for i in range(n):
        (ax, ay), (bx_, by) = pts[i], pts[(i + 1) % n]; wall(m, ax, ay, bx_, by, z0, z1, i * 2 * math.pi * r / n)
    if top: poly3(m, [(x, y, z1) for x, y in pts], [(x, y) for x, y in pts])
def flat(m, g, z, up=True):
    if g is None or g.is_empty: return
    tw, th = TILE.get(m, (1.0, 1.0))
    for p in (g.geoms if hasattr(g, "geoms") else [g]):
        if p.geom_type != "Polygon" or p.area < 0.05: continue
        try: tris = shapely.constrained_delaunay_triangles(p)
        except Exception: tris = shapely.ops.triangulate(p)
        for t in (tris.geoms if hasattr(tris, "geoms") else tris):
            if not p.buffer(1e-6).contains(t.centroid) and not p.contains(t.representative_point()): continue
            c = list(t.exterior.coords)[:3]
            if Polygon(c).exterior.is_ccw != up: c = c[::-1]
            poly3(m, [(x, y, z) for x, y in c], [(x / tw, y / th) for x, y in c])
def ribbon(m, line, z0, z1, both=True):
    """Vertical faces along a polyline (walls, kerbs)."""
    c = list(line.coords); u = 0.0
    for (ax, ay), (bx_, by) in zip(c, c[1:]):
        wall(m, ax, ay, bx_, by, z0, z1, u)
        if both: wall(m, bx_, by, ax, ay, z0, z1, u)
        u += math.hypot(bx_ - ax, by - ay)
def runs(x0, x1, yf, yb):
    """The four faces of a rectangle as (name, start(x,y), end(x,y), outward normal), counter-clockwise from the front."""
    return [("front", (x0, yf), (x1, yf), (0, -1)), ("east", (x1, yf), (x1, yb), (1, 0)), ("back", (x1, yb), (x0, yb), (0, 1)), ("west", (x0, yb), (x0, yf), (-1, 0))]

def hedge_along(line, w, h, z0=0.06):
    c = list(line.coords)
    for (ax_, ay_), (bx2, by2) in zip(c, c[1:]):
        L_ = math.hypot(bx2 - ax_, by2 - ay_)
        if L_ < 0.5: continue
        bx("hero_hedge", (ax_ + bx2) / 2, (ay_ + by2) / 2, z0, z0 + h, L_, w, math.atan2(by2 - ay_, bx2 - ax_))
def shrub(m, x, y, z, r, cards=14, tall=1.0):
    for _ in range(cards):
        a = RND.uniform(0, math.pi); u_, v_ = RND.uniform(-1, 1), RND.uniform(-0.2, 1)
        cx_, cy_, cz_ = x + math.cos(a) * u_ * r * 0.5, y + math.sin(a) * u_ * r * 0.5, z + (r * 0.45 + v_ * r * 0.45) * tall
        s = r * RND.uniform(0.55, 0.8); t = RND.uniform(-0.6, 0.6)
        ex, ey = math.cos(a) * s, math.sin(a) * s; fx, fy, fz = -math.sin(a) * math.sin(t) * s, math.cos(a) * math.sin(t) * s * tall, math.cos(t) * s * tall
        P = [(cx_ + sx * ex + sy * fx, cy_ + sx * ey + sy * fy, cz_ + sy * fz) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        poly3(m, P, [(0, 1), (1, 1), (1, 0), (0, 0)])
def clump(m, x, y, z, h, w, cards=5):
    """Upright crossed cards rooted at the ground (ornamental grass): the texture's foot is the card's foot."""
    for k in range(cards):
        a = k * math.pi / cards + RND.uniform(-0.2, 0.2); ex, ey = math.cos(a) * w / 2, math.sin(a) * w / 2
        poly3(m, [(x - ex, y - ey, z), (x + ex, y + ey, z), (x + ex, y + ey, z + h), (x - ex, y - ey, z + h)], [(0, 1), (1, 1), (1, 0), (0, 0)])
X0, X1 = -W / 2, W / 2
coll("Building_Facades")

if GRADE_A:
    # ------------------------------------------------------------------ the building (local frame: front face at y = YF, x along it)
    X0, X1 = -W / 2, W / 2
    CORE = 3.6                      # stone-clad corner cores
    COL_SP = 8.4
    def face_runs():
        """The four faces as (name, start(x,y), end(x,y), outward normal), counter-clockwise from the front."""
        return [("front", (X0, YF), (X1, YF), (0, -1)), ("east", (X1, YF), (X1, YB), (1, 0)), ("back", (X1, YB), (X0, YB), (0, 1)), ("west", (X0, YB), (X0, YF), (-1, 0))]
    BAY = W * 0.5                   # the framed bay in the middle of the road face
    PORTAL = 12.0                   # the double-height entrance, 12 m wide
    PORTAL_H = GH + FH              # 9.0 m

    coll("Architecture")
    # plinth: the ground floor sits 0.45 m above the forecourt
    plinth = Polygon([(X0 - 0.6, YF - 0.6), (X1 + 0.6, YF - 0.6), (X1 + 0.6, YB + 0.6), (X0 - 0.6, YB + 0.6)])
    flat("hero_stone", plinth, 0.45); ribbon("hero_stone", LineString(list(plinth.exterior.coords)), 0.0, 0.45, both=False)

    coll("Building_Facades")
    for name, (ax, ay), (bx_, by), (nx, ny) in face_runs():
        L = math.hypot(bx_ - ax, by - ay); ux, uy = (bx_ - ax) / L, (by - ay) / L
        at = lambda s, off=0.0: (ax + ux * s + nx * off, ay + uy * s + ny * off)
        front = name == "front"
        # --- corner cores: stone from the plinth to above the parapet, a slot window up each face
        for s0 in (0.0, L - CORE):
            p0, p1 = at(s0), at(s0 + CORE)
            wall("hero_stone", *p0, *p1, 0.45, H + PAR + 0.8, u0=s0)
            sx, sy = at(s0 + CORE / 2 - 0.2, 0.02); ex, ey = at(s0 + CORE / 2 + 0.2, 0.02)
            wall("hero_glass", sx, sy, ex, ey, GH + 0.6, H - 0.6, u0=0)
        run0, run1 = CORE, L - CORE
        # --- ground floor: stone columns on the face line, glazing set back behind them
        inset = 2.4 if front else 0.9
        n_col = max(2, round((run1 - run0) / COL_SP)); sp = (run1 - run0) / n_col
        for k in range(n_col + 1):
            s = run0 + k * sp
            if front and abs(s - L / 2) < PORTAL / 2 + 0.2: continue
            cx, cy = at(s, -0.4); bx("hero_stone", cx, cy, 0.45, GH, 0.8, 0.8, math.atan2(uy, ux))
        gx0, gy0 = at(run0, -inset); gx1, gy1 = at(run1, -inset)
        if front:   # either side of the portal
            for s_a, s_b in ((run0, L / 2 - PORTAL / 2), (L / 2 + PORTAL / 2, run1)):
                p, q = at(s_a, -inset), at(s_b, -inset); wall("hero_glass", *p, *q, 0.45, GH - 0.5, u0=s_a, v_top=GH + 3.0)
                wall("hero_spandrel", *p, *q, GH - 0.5, GH, u0=s_a)
        else:
            wall("hero_glass", gx0, gy0, gx1, gy1, 0.45, GH - 0.5, u0=run0, v_top=GH + 3.0); wall("hero_spandrel", gx0, gy0, gx1, gy1, GH - 0.5, GH, u0=run0)
        # soffit over the colonnade
        sof = Polygon([at(run0, 0), at(run1, 0), at(run1, -inset), at(run0, -inset)])
        flat("lobby_ceiling", sof, GH - 0.02, up=False)
        # --- upper floors: curtain wall on the face line
        zlo = GH
        for s_a, s_b, z_a in ((run0, run1, GH),) if not front else ((run0, L / 2 - PORTAL / 2, GH), (L / 2 - PORTAL / 2, L / 2 + PORTAL / 2, PORTAL_H), (L / 2 + PORTAL / 2, run1, GH)):
            p, q = at(s_a, 0), at(s_b, 0); wall("hero_glass", *p, *q, z_a, H, u0=s_a - run0, v_top=H)
            # mullions every 1.5 m and a transom at each sill
            for s in np.arange(s_a, s_b + 0.01, 1.5):
                cx, cy = at(s, 0.09); bx("hero_mullion", cx, cy, z_a, H, 0.07, 0.18, math.atan2(uy, ux))
            for k in range(NF + 1):
                z = GH + k * FH
                if z < z_a - 0.01: continue
                (p0x, p0y), (p1x, p1y) = at(s_a, 0.04), at(s_b, 0.04)
                if k < NF:   # spandrel band at the slab
                    wall("hero_spandrel", p0x, p0y, p1x, p1y, z - 0.35, z + 0.75, u0=s_a)
                    wall("hero_mullion", *at(s_a, 0.1), *at(s_b, 0.1), z + 0.75, z + 0.83, u0=s_a)
        # slab-edge bands at every floor and the roof: champagne aluminium, 0.5 m proud
        for k in range(NF + 1):
            z = GH + k * FH; p, q = at(-0.5 if name == "front" else 0, 0.5), at(L + (0.5 if name == "front" else 0), 0.5)
            if front and k == 0:   # broken over the portal (the double-height entrance)
                for s_a, s_b in ((run0, L / 2 - PORTAL / 2), (L / 2 + PORTAL / 2, run1)):
                    wall("hero_alu", *at(s_a, 0.5), *at(s_b, 0.5), z - 0.4, z + 0.05, u0=s_a)
                    flat("hero_alu", Polygon([at(s_a, 0), at(s_b, 0), at(s_b, 0.5), at(s_a, 0.5)]), z + 0.05)
                    flat("hero_alu", Polygon([at(s_a, 0), at(s_b, 0), at(s_b, 0.5), at(s_a, 0.5)]), z - 0.4, up=False)
                continue
            wall("hero_alu", *at(run0, 0.5), *at(run1, 0.5), z - 0.4, z + 0.05, u0=run0)
            band = Polygon([at(run0, 0), at(run1, 0), at(run1, 0.5), at(run0, 0.5)])
            flat("hero_alu", band, z + 0.05); flat("hero_alu", band, z - 0.4, up=False)
        # vertical fins: in the framed bay of the road face (deep), every 3 m on the sides
        if front:
            b0, b1 = L / 2 - BAY / 2, L / 2 + BAY / 2
            for s in np.arange(b0 + 1.5, b1 - 0.5, 1.5):
                if abs(s - L / 2) < PORTAL / 2: z0 = PORTAL_H
                else: z0 = GH
                cx, cy = at(s, 0.35); bx("hero_alu", cx, cy, z0, H, 0.08, 0.7, math.atan2(uy, ux))
            # the frame: two blades and a head, 1.3 m proud of the glass
            for s in (b0, b1):
                cx, cy = at(s, 0.65); bx("hero_alu", cx, cy, GH - 0.4, H + PAR + 0.6, 0.9, 1.3, math.atan2(uy, ux))
            cx, cy = at(L / 2, 0.65); bx("hero_alu", cx, cy, H - 0.4, H + PAR + 0.6, BAY + 0.9, 1.3, math.atan2(uy, ux), bottom=True)
        elif name in ("east", "west"):
            for s in np.arange(run0 + 3.0, run1 - 1.0, 3.0):
                cx, cy = at(s, 0.25); bx("hero_alu", cx, cy, GH, H, 0.06, 0.45, math.atan2(uy, ux))
        # parapet: outer face aluminium, inner concrete, coping
        p, q = at(run0, 0.02), at(run1, 0.02); wall("hero_alu", *p, *q, H, H + PAR, u0=run0)
        p, q = at(run1, -0.3), at(run0, -0.3); wall("hero_concrete", *p, *q, H, H + PAR)
        flat("hero_alu", Polygon([at(run0, 0.1), at(run1, 0.1), at(run1, -0.35), at(run0, -0.35)]), H + PAR + 0.04)

    coll("Rooftops")
    # corner core roofs
    for cx_, cy_ in ((X0 + CORE / 2, YF + CORE / 2), (X1 - CORE / 2, YF + CORE / 2), (X0 + CORE / 2, YB - CORE / 2), (X1 - CORE / 2, YB - CORE / 2)):
        hquad("hero_concrete", cx_ - CORE / 2, cy_ - CORE / 2, cx_ + CORE / 2, cy_ + CORE / 2, H + PAR + 0.8)
        for (sx, sy) in ((-1, 0), (1, 0), (0, -1), (0, 1)):   # the cores' inner faces above the roof
            pass
    # the roof
    roofp = Polygon([(X0 + 0.3, YF + 0.3), (X1 - 0.3, YF + 0.3), (X1 - 0.3, YB - 0.3), (X0 + 0.3, YB - 0.3)])
    flat("hero_roof", roofp, H + 0.02)
    # the cores' faces seen from the roof (inside the parapet)
    for cx_, cy_ in ((X0 + CORE / 2, YF + CORE / 2), (X1 - CORE / 2, YF + CORE / 2), (X0 + CORE / 2, YB - CORE / 2), (X1 - CORE / 2, YB - CORE / 2)):
        bx("hero_stone", cx_, cy_, H, H + PAR + 0.8, CORE - 0.02, CORE - 0.02, top=False)

    # ------------------------------------------------------------------ roof equipment
    # lift machine room and stair headroom in the middle; chillers, cooling towers, tanks to one side; solar to the other
    bx("hero_concrete", 0, YF + D * 0.42, H, H + 4.2, 9.0, 6.5); bx("hero_mullion", 0, YF + D * 0.42 - 3.27, H + 0.1, H + 2.4, 1.2, 0.06, top=False)
    for k in range(3):
        cx_ = X0 + 7 + k * 6.5; cy_ = YB - 7
        bx("hero_hvac", cx_, cy_, H + 0.3, H + 2.6, 5.4, 2.2); bx("hero_concrete", cx_, cy_, H, H + 0.3, 5.8, 2.6)
        for f in range(3): cyl("hero_dark", cx_ - 1.8 + f * 1.8, cy_, H + 2.6, H + 2.72, 0.75, 14)
    for k in range(2):
        cx_ = X0 + 8 + k * 6.0; cy_ = YB - 15
        bx("hero_hvac", cx_, cy_, H, H + 3.2, 4.2, 4.2); cyl("hero_hvac", cx_, cy_, H + 3.2, H + 4.1, 1.7, 18, top=False); cyl("hero_dark", cx_, cy_, H + 3.3, H + 3.95, 1.55, 18)
    bx("hero_concrete", X1 - 9, YB - 7, H, H + 0.6, 7.5, 5.0)
    for k in range(4):
        cyl("tank", X1 - 11.6 + (k % 2) * 3.0 + (k // 2) * 0, YB - 8.3 + (k // 2) * 2.6, H + 0.6, H + 2.8, 1.1, 16)
    # solar array: rows of 1 x 2 m panels tilted 20 degrees towards the south (local direction worked out from the frame)
    sun_dir = np.array([0.0, -1.0]); sl = np.array([np.dot(sun_dir, U), np.dot(sun_dir, NIN)])   # south in local coordinates
    ang = math.atan2(sl[1], sl[0]) - math.pi / 2
    for r in range(6):
        for k in range(9):
            lx, ly = 3.0 + k * 2.15 - 2.0, YF + 8 + r * 3.6
            if lx > X1 - 6: continue
            c, s = math.cos(ang), math.sin(ang); tilt = math.radians(20)
            corners = []
            for (px, py) in ((-1.0, -0.5), (1.0, -0.5), (1.0, 0.5), (-1.0, 0.5)):
                zz = H + 0.6 + (py + 0.5) * math.sin(tilt) * 1.0; py2 = py * math.cos(tilt)
                corners.append((lx + c * px - s * py2, ly + s * px + c * py2, zz))
            poly3("hero_solar", corners, [(0, 0), (1, 0), (1, 1), (0, 1)])
            poly3("hero_hvac", corners[::-1], [(0, 0)] * 4)
            cyl("hero_hvac", lx, ly, H, H + 0.6, 0.05, 6, top=False)

    coll("Architecture")
    # ------------------------------------------------------------------ the entrance: double-height portal, canopy, lobby
    pf = YF; pin = YF + 2.4
    wall("hero_lobby_glass", -PORTAL / 2, pin, PORTAL / 2, pin, 0.45, PORTAL_H - 0.1)
    for s in np.arange(-PORTAL / 2, PORTAL / 2 + 0.01, 2.0): bx("hero_mullion", s, pin - 0.06, 0.45, PORTAL_H - 0.1, 0.08, 0.14)
    flat("lobby_ceiling", Polygon([(-PORTAL / 2, pf), (PORTAL / 2, pf), (PORTAL / 2, pin + 12), (-PORTAL / 2, pin + 12)]), PORTAL_H - 0.05, up=False)
    for jx in (-PORTAL / 2 - 0.5, PORTAL / 2 + 0.5): bx("hero_alu", jx, pf - 0.2, 0.45, PORTAL_H + 0.6, 1.0, 1.4)
    bx("hero_alu", 0, pf - 0.2, PORTAL_H, PORTAL_H + 0.6, PORTAL + 2.0, 1.4, bottom=True)
    # the lobby inside: stone floor, a feature wall, reception desk, a grid of lights
    flat("hero_stone", Polygon([(-PORTAL / 2, pin), (PORTAL / 2, pin), (PORTAL / 2, pin + 12), (-PORTAL / 2, pin + 12)]), 0.46)
    wall("hero_alu", PORTAL / 2, pin + 12, -PORTAL / 2, pin + 12, 0.46, PORTAL_H - 0.05)
    for wx in (-PORTAL / 2, PORTAL / 2): wall("hero_stone", wx, pin + 12 if wx < 0 else pin, wx, pin if wx < 0 else pin + 12, 0.46, PORTAL_H - 0.05)
    bx("hero_stone", 0, pin + 9.0, 0.46, 1.55, 6.0, 1.0, mats=("hero_stone", "hero_dark"))
    for gx in np.arange(-PORTAL / 2 + 1.5, PORTAL / 2, 3.0):
        for gy in np.arange(pin + 1.5, pin + 12, 3.0): hquad("lobby_light", gx - 0.6, gy - 0.6, gx + 0.6, gy + 0.6, PORTAL_H - 0.08, up=False)
    # entrance steps and the canopy (7 m cantilever, 16 m wide, 0.45 m deep)
    for k in range(3): bx("hero_stone", 0, YF - 1.2 - k * 0.4, 0.0, 0.45 - k * 0.15, PORTAL + 1.0, 0.4 + 0.8 * (k == 0))
    CW, CD, CZ = 16.0, 7.0, GH + 0.1
    bx("hero_alu", 0, YF - CD / 2, CZ, CZ + 0.45, CW, CD, mats=("hero_alu", "hero_alu"))
    hquad("lobby_ceiling", -CW / 2, YF - CD, CW / 2, YF, CZ - 0.005, up=False)
    for gx in np.arange(-CW / 2 + 1.0, CW / 2, 2.0):
        for gy in (YF - CD + 1.2, YF - CD / 2, YF - 1.2): cyl("lobby_light", gx, gy, CZ - 0.02, CZ - 0.01, 0.12, 8)


# ------------------------------------------------------------------ Grade B: plaster, ribbon windows, chajjas, pilasters
if FAM == "banded":
    PL = "hero_plaster"
    ACC = {"alu": "hero_alu", "stone": "hero_stone"}.get(SP.get("accent"), "hero_plaster_b")
    PIL, SILL, LIN, REC, CH = 1.1, 0.95, 0.75, 0.18, 0.6
    STILT = SP["ground"] == "stilt"
    Z0 = 0.15 if STILT else 0.45                        # plinth height
    PORTAL = 8.0; PORTAL_H = GH - 0.3
    CW, CD = 10.0, 4.5; CZ = min(GH - 0.9, 3.6)          # entrance canopy
    def bays(L, step=13.0):
        """Pilaster centres along a face of length L, and the window bays between them."""
        n = max(1, round((L - 2 * PIL) / step)); cs = [PIL / 2] + [PIL + (L - 2 * PIL) * k / n for k in range(1, n)] + [L - PIL / 2]
        return cs, [(cs[i] + PIL / 2, cs[i + 1] - PIL / 2) for i in range(len(cs) - 1)]
    def banded_block(x0, x1, yf, yb, floors, z_pil0, top, front_open=None, acs=False):
        """Floors (1-based numbers) of plaster and ribbon windows on a rectangle, pilasters from z_pil0, parapet at top."""
        for name, (ax, ay), (bx_, by), (nx, ny) in runs(x0, x1, yf, yb):
            L = math.hypot(bx_ - ax, by - ay); ux, uy = (bx_ - ax) / L, (by - ay) / L; rot = math.atan2(uy, ux)
            at = lambda s, off=0.0: (ax + ux * s + nx * off, ay + uy * s + ny * off)
            pil, bys = bays(L)
            coll("Building_Facades")
            for s in pil:
                cx, cy = at(s, 0.05); bx(ACC, cx, cy, z_pil0, top + PAR + 0.25, PIL, 0.55, rot)
            for k in floors:
                z = GH + (k - 1) * FH
                for s_a, s_b in bys:
                    coll("Building_Facades")
                    wall(PL, *at(s_a), *at(s_b), z, z + SILL, u0=s_a); wall(PL, *at(s_a), *at(s_b), z + FH - LIN, z + FH, u0=s_a)
                    wall("hero_glass", *at(s_a, -REC), *at(s_b, -REC), z + SILL, z + FH - LIN, u0=s_a, v_top=z + FH + 1.0)
                    rev = Polygon([at(s_a), at(s_b), at(s_b, -REC), at(s_a, -REC)])
                    flat(PL, rev, z + SILL); flat(PL, rev, z + FH - LIN, up=False)
                    coll("Windows_And_Balconies")
                    for s in np.arange(s_a + 1.5, s_b - 0.3, 1.5):
                        cx, cy = at(s, -REC + 0.04); bx("hero_mullion", cx, cy, z + SILL, z + FH - LIN, 0.06, 0.1, rot)
                    cx, cy = at((s_a + s_b) / 2, CH / 2)    # the chajja over the window band
                    bx("hero_concrete", cx, cy, z + FH - LIN - 0.06, z + FH - LIN + 0.06, s_b - s_a + 0.3, CH, rot, bottom=True)
                    if acs and name != "front":            # wall-mounted split AC units, an older block's tell
                        for s in np.arange(s_a + 2.0, s_b - 1.0, 4.5):
                            if RND.random() < 0.35:
                                cx, cy = at(s, 0.2); bx("hero_hvac", cx, cy, z + 0.15, z + 0.72, 0.85, 0.3, rot)
            # parapet: plaster outside, concrete inside, a coping
            coll("Rooftops")
            wall(PL, *at(0, 0), *at(L, 0), top, top + PAR, u0=0); wall("hero_concrete", *at(L, -0.25), *at(0, -0.25), top, top + PAR)
            flat(ACC, Polygon([at(0, 0.05), at(L, 0.05), at(L, -0.3), at(0, -0.3)]), top + PAR + 0.03)
        coll("Rooftops"); flat("hero_roof", box(x0 + 0.25, yf + 0.25, x1 - 0.25, yb - 0.25), top + 0.02)

    full_floors = list(range(1, (UPPER["from"] if UPPER else NF + 1)))
    banded_block(X0, X1, YF, YB, full_floors, 0.0, HF, acs=SP.get("split_acs"))
    if UPPER:   # the smaller upper floors at the back, a terrace in front of them
        k = math.sqrt(UPPER["sqft"] * SQFT / (W * D)); WU, DU = W * k, D * k
        UX0, UX1, UYF, UYB = -WU / 2, WU / 2, YB - DU, YB
        banded_block(UX0, UX1, UYF, UYB, list(range(UPPER["from"], NF + 1)), HF, H, acs=SP.get("split_acs"))
        coll("Landscaping")
        terr = box(X0 + 0.3, YF + 0.3, X1 - 0.3, YB - 0.3).difference(box(UX0 - 0.6, UYF - 0.6, UX1 + 0.6, UYB))
        flat("hero_pavers", terr, HF + 0.06)
        coll("Windows_And_Balconies")   # a railing on the terrace parapet
        for nm, (ax, ay), (bx_, by), _n in runs(X0, X1, YF, YB):
            if nm == "back": continue
            ls = LineString([(ax, ay), (bx_, by)]).parallel_offset(0.12, "left")
            for d in np.arange(0.0, ls.length, 0.16):
                p = ls.interpolate(d); bx("hero_rail", p.x, p.y, HF + PAR, HF + PAR + 0.5, 0.022, 0.022, top=False)
        UPPER_FOOT = [T(UX0, UYF), T(UX1, UYF), T(UX1, UYB), T(UX0, UYB)]
        TOP_RECT = (UX0, UX1, UYF, UYB)
    else:
        TOP_RECT = (X0, X1, YF, YB)

    # --- the ground floor
    coll("Architecture")
    plinth = box(X0 - 0.4, YF - 0.4, X1 + 0.4, YB + 0.4)
    flat("hero_concrete" if STILT else "hero_stone", plinth, Z0); ribbon("hero_concrete" if STILT else "hero_stone", LineString(list(plinth.exterior.coords)), 0.0, Z0, both=False)
    if STILT:   # open stilt parking: columns on the face lines, a soffit, the shade of the deep interior
        for nm, (ax, ay), (bx_, by), _n in runs(X0, X1, YF, YB):
            L = math.hypot(bx_ - ax, by - ay); ux, uy = (bx_ - ax) / L, (by - ay) / L
            n = max(2, round(L / 7.5))
            for i in range(1, n):
                s = L * i / n
                if nm == "front" and abs(s - L / 2) < PORTAL / 2 + 0.6: continue
                bx("hero_plaster_b", ax + ux * s, ay + uy * s, Z0, GH, 0.6, 0.6, math.atan2(uy, ux))
        flat("hero_concrete", box(X0, YF, X1, YB), GH - 0.02, up=False)
        inner = box(X0, YF, X1, YB).buffer(-8.0, join_style="mitre")
        if not inner.is_empty: ribbon("hero_dark", LineString(list(inner.exterior.coords)[::-1]), Z0, GH - 0.02, both=False)
        coll("Street_Infrastructure")    # bays under the stilt, along the front and the sides
        for nm, (ax, ay), (bx_, by), (nx, ny) in runs(X0, X1, YF, YB):
            L = math.hypot(bx_ - ax, by - ay); ux, uy = (bx_ - ax) / L, (by - ay) / L
            for s in np.arange(2.0, L - 2.0, 2.6):
                if nm == "front" and abs(s - L / 2) < PORTAL / 2 + 1.5: continue
                if nm == "back": continue
                px, py = ax + ux * s - nx * 0.8, ay + uy * s - ny * 0.8
                bx("marking", px - nx * 2.5, py - ny * 2.5, Z0 + 0.005, Z0 + 0.01, 0.08, 5.0, math.atan2(uy, ux), top=True)
    else:       # a glazed ground floor behind plaster piers
        banded_block_ground = True
        for nm, (ax, ay), (bx_, by), (nx, ny) in runs(X0, X1, YF, YB):
            L = math.hypot(bx_ - ax, by - ay); ux, uy = (bx_ - ax) / L, (by - ay) / L
            at = lambda s, off=0.0: (ax + ux * s + nx * off, ay + uy * s + ny * off)
            pil, bys = bays(L)
            for s_a, s_b in bys:
                spans = [(s_a, s_b)]
                if nm == "front": spans = [(a_, b_) for a_, b_ in ((s_a, min(s_b, L / 2 - PORTAL / 2 - 0.6)), (max(s_a, L / 2 + PORTAL / 2 + 0.6), s_b)) if b_ - a_ > 0.5]
                    # the portal's own jambs
                for a_, b_ in spans:
                    coll("Building_Facades")
                    wall(PL, *at(a_), *at(b_), Z0, Z0 + 0.6, u0=a_); wall(PL, *at(a_), *at(b_), GH - 0.9, GH, u0=a_)
                    wall("hero_glass", *at(a_, -REC), *at(b_, -REC), Z0 + 0.6, GH - 0.9, u0=a_, v_top=GH + 1.0)
                    rev = Polygon([at(a_), at(b_), at(b_, -REC), at(a_, -REC)]); flat(PL, rev, Z0 + 0.6); flat(PL, rev, GH - 0.9, up=False)
                    coll("Windows_And_Balconies")
                    for s in np.arange(a_ + 1.5, b_ - 0.3, 1.5):
                        cx, cy = at(s, -REC + 0.04); bx("hero_mullion", cx, cy, Z0 + 0.6, GH - 0.9, 0.06, 0.1, math.atan2(uy, ux))
            if nm == "front":
                coll("Building_Facades")
                for s in (L / 2 - PORTAL / 2 - 0.6, L / 2 + PORTAL / 2 + 0.6):
                    a2 = s - 0.3; b2 = s + 0.3
                    wall(PL, *at(a2), *at(b2), Z0, GH, u0=a2)
                wall(PL, *at(L / 2 - PORTAL / 2), *at(L / 2 + PORTAL / 2), PORTAL_H, GH, u0=0)
    # --- the entrance: a glazed lobby set 1.5 m back, a canopy, steps
    coll("Architecture")
    pin = YF + 1.5; LD = 7.0
    wall("hero_lobby_glass", -PORTAL / 2, pin, PORTAL / 2, pin, Z0, PORTAL_H)
    for wx, (sx0, sx1) in ((-PORTAL / 2, (pin + LD, pin)), (PORTAL / 2, (pin, pin + LD))):
        wall("hero_lobby_glass" if STILT else "hero_stone", wx, sx0, wx, sx1, Z0, PORTAL_H)
    coll("Windows_And_Balconies")
    for s in np.arange(-PORTAL / 2, PORTAL / 2 + 0.01, 2.0): bx("hero_mullion", s, pin - 0.06, Z0, PORTAL_H, 0.08, 0.14)
    coll("Architecture")
    flat("hero_stone", box(-PORTAL / 2, pin, PORTAL / 2, pin + LD), Z0 + 0.01)
    flat("lobby_ceiling", box(-PORTAL / 2, YF, PORTAL / 2, pin + LD), PORTAL_H - 0.02, up=False)
    wall("hero_alu", PORTAL / 2, pin + LD, -PORTAL / 2, pin + LD, Z0, PORTAL_H)
    bx("hero_stone", 0, pin + LD - 1.6, Z0, Z0 + 1.1, 4.0, 0.8, mats=("hero_stone", "hero_dark"))
    for gx in np.arange(-PORTAL / 2 + 1.0, PORTAL / 2, 2.0):
        for gy in np.arange(pin + 1.0, pin + LD, 2.0): hquad("lobby_light", gx - 0.4, gy - 0.4, gx + 0.4, gy + 0.4, PORTAL_H - 0.04, up=False)
    if not STILT:
        for k in range(2): bx("hero_stone", 0, YF - 0.9 - k * 0.4, 0.0, Z0 - k * 0.2, PORTAL + 1.0, 0.4 + 0.6 * (k == 0))
    bx(ACC if ACC != "hero_plaster_b" else "hero_alu", 0, YF - CD / 2, CZ, CZ + 0.35, CW, CD)
    hquad("lobby_ceiling", -CW / 2, YF - CD, CW / 2, YF, CZ - 0.005, up=False)
    for sx in (-CW / 2 + 0.4, CW / 2 - 0.4): cyl("hero_rail", sx, YF - CD + 0.4, Z0 if not STILT else 0.0, CZ, 0.09, 10, top=False)
    for gx in np.arange(-CW / 2 + 1.0, CW / 2, 2.0):
        for gy in (YF - CD + 1.0, YF - 1.0): cyl("lobby_light", gx, gy, CZ - 0.02, CZ - 0.01, 0.1, 8)

    # --- roof plant on the top block: lift machine room, stair headroom, tanks, VRV condensers, solar if the spec says so
    coll("Rooftops")
    rx0, rx1, ryf, ryb = TOP_RECT; rw, rd = rx1 - rx0, ryb - ryf
    bx("hero_plaster_b", rx0 + rw * 0.5, ryf + rd * 0.55, H, H + 3.4, 6.0, 4.5); bx("hero_dark", rx0 + rw * 0.5, ryf + rd * 0.55 - 2.26, H + 0.1, H + 2.2, 1.0, 0.04, top=False)
    bx("hero_concrete", rx1 - 6.5, ryb - 4.5, H, H + 0.5, 6.0, 4.0)
    for kk in range(4): cyl("tank", rx1 - 8.0 + (kk % 2) * 2.8, ryb - 5.6 + (kk // 2) * 2.4, H + 0.5, H + 2.5, 1.0, 16)
    for r_ in range(2):
        for c_ in range(4):
            cx_, cy_ = rx0 + 4.0 + c_ * 1.9, ryb - 4.0 - r_ * 2.6
            bx("hero_hvac", cx_, cy_, H + 0.2, H + 1.9, 1.3, 0.8); cyl("hero_dark", cx_, cy_, H + 1.9, H + 1.96, 0.45, 12)
    if SP.get("solar"):
        for r_ in range(3):
            for c_ in range(int((rw - 10) // 2.15)):
                lx, ly = rx0 + 3.0 + c_ * 2.15, ryf + 3.0 + r_ * 3.4
                if ly > ryf + rd * 0.55 - 3.5: continue
                tilt = math.radians(20)
                corners = [(lx + px, ly + py * math.cos(tilt), H + 0.6 + (py + 0.5) * math.sin(tilt)) for px, py in ((-1.0, -0.5), (1.0, -0.5), (1.0, 0.5), (-1.0, 0.5))]
                poly3("hero_solar", corners, [(0, 0), (1, 0), (1, 1), (0, 1)]); poly3("hero_hvac", corners[::-1], [(0, 0)] * 4)
                cyl("hero_hvac", lx, ly, H, H + 0.6, 0.05, 6, top=False)

# ------------------------------------------------------------------ the JindalX families, driven by the spec: a level engine
# Each storey has a plan (the union of the spec's boxes that reach that storey); every exterior edge of a plan gets the facade of the
# box that owns it; where a plan is bigger or smaller than the one above there is a terrace or a soffit. The facades are small
# functions per "kind": panels and glazing at true scale, recessed glass with real reveals, no overlapping coplanar faces.
NAME_SPOT = None; LABELS = []; ENTR = []; EXTRA_COLL = {}
if not LEGACY:
    from shapely.geometry.polygon import orient
    PLW, PLC = "hero_plaster_white", "hero_plaster_cream"
    def ZB(k): return 0.0 if k == 0 else GH + (k - 1) * FH       # bottom of storey k (0 = ground)
    def ZT(k): return GH + k * FH                                  # top of storey k
    BOXES = []
    for bd in SP["boxes"]:
        if "poly" in bd: g_ = Polygon([(X0 + p[0], YF + p[1]) for p in bd["poly"]])
        elif "tower" in bd:
            tx, ty = bd["tower"]["at"]; g_ = Point(X0 + tx, YF + ty).buffer(bd["tower"]["r"], 4)
        else: g_ = box(X0 + bd["x"][0], YF + bd["y"][0], X0 + bd["x"][1], YF + (bd["y"][1] if len(bd["y"]) > 1 and bd["y"][1] is not None else D))
        if bd.get("cut"): g_ = g_.difference(box(X0 + bd["cut"][0], YF + bd["cut"][1], X0 + bd["cut"][2], YF + bd["cut"][3]))
        BOXES.append(dict(bd, g=orient(g_.buffer(0), 1.0)))
    KMAX = max(b["l"][1] for b in BOXES) - 1
    def plan(k):
        ps = [b["g"] for b in BOXES if b["l"][0] <= k < b["l"][1]]
        return unary_union(ps) if ps else Polygon()
    def polys_of(g): return [p for p in (g.geoms if hasattr(g, "geoms") else [g]) if p.geom_type == "Polygon" and p.area > 0.3]
    def mk_seg(a, b_):
        L = math.hypot(b_[0] - a[0], b_[1] - a[1]); ux, uy = (b_[0] - a[0]) / L, (b_[1] - a[1]) / L
        return {"a": a, "L": L, "u": (ux, uy), "n": (uy, -ux), "s0": a[0] * ux + a[1] * uy, "rot": math.atan2(uy, ux)}
    def seg_of(a, b_):
        sg = mk_seg(a, b_); sg["front"] = sg["n"][1] < -0.99 and abs(sg["u"][1]) < 0.01     # a face on the front line direction, looking at the road
        sg["side"] = abs(sg["n"][0]) > 0.99
        return sg
    def PT(sg, s, off=0.0): return (sg["a"][0] + sg["u"][0] * s + sg["n"][0] * off, sg["a"][1] + sg["u"][1] * s + sg["n"][1] * off)
    def WL(m, sg, s0_, s1_, z0, z1, off=0.0, vo=None, u0=None):
        if s1_ - s0_ < 1e-3 or z1 - z0 < 1e-3: return
        p, q = PT(sg, s0_, off), PT(sg, s1_, off); wall(m, *p, *q, z0, z1, u0=(sg["s0"] + s0_) if u0 is None else u0, vo=vo)
    def BXs(m, sg, s0_, s1_, o0, o1, z0, z1, top=True, bottom=False):
        if s1_ - s0_ < 1e-3: return
        cx, cy = PT(sg, (s0_ + s1_) / 2, (o0 + o1) / 2); bx(m, cx, cy, z0, z1, s1_ - s0_, o1 - o0, sg["rot"], top=top, bottom=bottom)
    def HQ(m, sg, s0_, s1_, o0, o1, z, up=True):
        pts = [PT(sg, s0_, o0), PT(sg, s1_, o0), PT(sg, s1_, o1), PT(sg, s0_, o1)]       # u then inward (o1 < o0) is counter-clockwise: faces up
        if not up: pts = pts[::-1]
        tw, th = TILE.get(m, (1.0, 1.0)); poly3(m, [(x, y, z) for x, y in pts], [(x / tw, y / th) for x, y in pts])
    def punched(sg, z0, z1, wins, zw0, zw1, wlo, whi, wpier, gmat, rec=0.22, mull=None, jmat=None):
        """A wall z0..z1 with recessed glazed windows (s0, s1) between zw0 and zw1; reveals returned into the opening."""
        L = sg["L"]; jmat = jmat or wpier
        WL(wlo, sg, 0, L, z0, zw0); WL(whi, sg, 0, L, zw1, z1)
        cur = 0.0
        for a_, b_ in sorted(wins):
            if a_ > cur + 1e-3: WL(wpier, sg, cur, a_, zw0, zw1)
            WL(gmat, sg, a_, b_, zw0, zw1, off=-rec, vo=(zw0 if gmat == "hero_glass_teal" else z0 if gmat in STOREY_GLASS else None), u0=(0.0 if gmat == "hero_glass_teal" else None))
            wall(jmat, *PT(sg, a_, 0), *PT(sg, a_, -rec), zw0, zw1, u0=0); wall(jmat, *PT(sg, b_, -rec), *PT(sg, b_, 0), zw0, zw1, u0=0)
            HQ(jmat, sg, a_, b_, 0, -rec, zw0, up=True); HQ(jmat, sg, a_, b_, 0, -rec, zw1, up=False)
            if mull:
                for s in np.arange(a_ + mull, b_ - mull / 2, mull): BXs("hero_mullion", sg, s - 0.035, s + 0.035, -rec - 0.01, 0.02, zw0, zw1, top=False)
            cur = b_
        if cur < L - 1e-3: WL(wpier, sg, cur, L, zw0, zw1)
    def cols_even(L, margin, pitch, w):
        n = max(1, int((L - 2 * margin + (pitch - w)) // pitch)); tot = n * pitch - (pitch - w); s0_ = (L - tot) / 2
        return [(s0_ + i * pitch, s0_ + i * pitch + w) for i in range(n)]
    STOREY_GLASS = {"hero_glass_bluegrey", "hero_glass_green"}
    # ----- facade kinds: fn(seg, k, z0, z1, box)
    def f_podium(sg, k, z0, z1, b_):
        if sg["front"]:
            L = sg["L"]; xa = sg["a"][0]; cur = 0.0
            bays = sorted([(X0 + bb["x"][0] - xa, X0 + bb["x"][1] - xa, bb) for bb in SP.get("bays", [])])
            for s0_, s1_, bb in bays:
                if s1_ <= 0 or s0_ >= L: continue
                s0_, s1_ = max(s0_, 0.0), min(s1_, L)
                if s0_ > cur: WL(PLW, sg, cur, s0_, z0, z1)
                j = 0.9 if bb["kind"] == "glass" else 1.1
                WL(PLW, sg, s0_, s0_ + j, z0, z1); WL(PLW, sg, s1_ - j, s1_, z0, z1)
                if bb["kind"] == "glass":
                    punched(sg, z0, z1, [(s0_ + j, s1_ - j)], 0.55, z1 - 0.9, PLW, PLW, PLW, "hero_glass_dark", rec=0.6, mull=1.9)
                else:   # the numbered entrance: a deep white frame, glazed doors, a lit lobby behind
                    punched(sg, z0, z1, [(s0_ + j, s1_ - j)], 0.0, z1 - 1.1, PLW, PLW, PLW, "hero_lobby_glass", rec=1.3, mull=2.0)
                    a_, b2 = s0_ + j, s1_ - j
                    WL("lobby_light", sg, a_, b2, 0.0, z1 - 1.1, off=-4.2)
                    for sx_ in (a_, b2): wall("lobby_ceiling", *PT(sg, sx_, -4.2), *PT(sg, sx_, -1.3), 0.0, z1 - 1.1) if sx_ == b2 else wall("lobby_ceiling", *PT(sg, sx_, -1.3), *PT(sg, sx_, -4.2), 0.0, z1 - 1.1)
                    HQ("hero_stone", sg, a_, b2, -1.3, -4.2, 0.03); HQ("lobby_ceiling", sg, a_, b2, -1.3, -4.2, z1 - 1.1, up=False)
                    HQ("hero_stone", sg, a_, b2, 0.0, -1.3, 0.03)
                    for sx_ in np.arange(a_ + 1.2, b2 - 0.6, 2.4): HQ("lobby_light", sg, sx_ - 0.5, sx_ + 0.5, -2.2, -3.2, z1 - 1.12, up=False)
                    pe = PT(sg, (s0_ + s1_) / 2, 0.0)
                    if bb.get("label"): LABELS.append((bb["label"], pe[0], pe[1] - 0.03, z1 - 0.95, 0.7))
                    BXs("hero_acp_white", sg, s0_ - 0.4, s1_ + 0.4, 0.0, 0.5, z1 - 0.12, z1 + 0.0)    # a thin cap line over the portal frame
                cur = s1_
            if cur < L: WL(PLW, sg, cur, L, z0, z1)
        else:
            WL(PLW, sg, 0, sg["L"], z0, z1)
            if sg["L"] > 9: WL("hero_glass_dark", sg, 1.5, sg["L"] - 1.5, 0.9, z1 - 1.0, off=0.04); WL("hero_mullion", sg, 1.5, sg["L"] - 1.5, z1 - 1.0, z1 - 0.9, off=0.05)
    def f_punch_dark(sg, k, z0, z1, b_):
        L = sg["L"]; wins = [(a_, b2) for a_, b2 in cols_even(L, 1.2, 3.0, 1.7)]
        punched(sg, z0, z1, wins, z0 + 1.0, z0 + 2.7, "hero_acp_charcoal", "hero_acp_charcoal", "hero_acp_charcoal", "hero_glass_dark", rec=0.2, jmat="hero_acp_charcoal")
        if k == 1: BXs("hero_acp_white", sg, 0, L, 0.0, 0.1, z0 - 0.12, z0 + 0.1)
    def f_glass(sg, k, z0, z1, b_):
        L = sg["L"]; pier = 0.0 if L < 8 else 0.6          # the dark glass tile carries its own 1.5 m bays, mullions and frit spandrels, two 4 m floors to the tile
        WL("hero_acp_charcoal", sg, 0, L, z1 - 0.12, z1)
        if pier: WL("hero_acp_charcoal", sg, 0, pier, z0, z1 - 0.12); WL("hero_acp_charcoal", sg, L - pier, L, z0, z1 - 0.12)
        WL("hero_glass_dark", sg, pier, L - pier, z0, z1 - 0.12, off=-0.12, u0=sg["s0"] + pier - 0.0)
        wall("hero_acp_charcoal", *PT(sg, pier, 0), *PT(sg, pier, -0.12), z0, z1 - 0.12) if pier else None
        wall("hero_acp_charcoal", *PT(sg, L - pier, -0.12), *PT(sg, L - pier, 0), z0, z1 - 0.12) if pier else None
        HQ("hero_acp_charcoal", sg, 0, L, 0.0, -0.12, z1 - 0.12, up=False)
        BXs("hero_acp_white", sg, 0, L, 0.0, 0.1, z1 - 0.14, z1 + 0.0)               # the pale slab-edge line of the render, at every floor
    def f_white(sg, k, z0, z1, b_):
        L = sg["L"]
        WL("hero_acp_white", sg, 0, L, z0, z1)
        for z in np.arange(z0 + 0.45, z1 - 0.3, 0.9): BXs("hero_acp_white", sg, 0.0, L, 0.0, 0.2, z, z + 0.14, top=True, bottom=False)    # the horizontal louvre fins
    def f_sign(sg, k, z0, z1, b_):
        WL("hero_acp_charcoal", sg, 0, sg["L"], z0, z1)
    def f_acp(sg, k, z0, z1, b_):
        L = sg["L"]; pier = min(4.5, L * 0.16)
        WL("hero_acp_charcoal", sg, 0, pier, z0, z1); WL("hero_acp_charcoal", sg, L - pier, L, z0, z1)
        WL("hero_glass_bluegrey", sg, pier, L - pier, z0, z1, off=-0.16, u0=sg["s0"] + pier)      # one storey of tile per floor: the spandrel band sits on the slab line
        wall("hero_acp_charcoal", *PT(sg, pier, 0), *PT(sg, pier, -0.16), z0, z1); wall("hero_acp_charcoal", *PT(sg, L - pier, -0.16), *PT(sg, L - pier, 0), z0, z1)
        BXs("hero_dark", sg, pier, L - pier, 0.0, 0.5, z1 - 0.08, z1, top=True)                    # black sunshade fin at the head of every band
        for s in np.arange(pier + 3.6, L - pier - 0.2, 4.8): BXs("hero_dark", sg, s - 0.03, s + 0.03, 0.0, 0.38, z0 + 0.5, z1 - 0.08, top=False)   # black vertical fins on the 1.2 m bay lines
        for s in np.arange(pier + 3.0, L - pier - 0.5, 9.6):      # awning windows: charcoal flaps hinged at the top, open at the foot
            zt_, zb_ = z0 + 3.0, z0 + 2.2
            P4 = [(*PT(sg, s - 0.55, -0.14), zt_), (*PT(sg, s + 0.55, -0.14), zt_), (*PT(sg, s + 0.55, 0.26), zb_), (*PT(sg, s - 0.55, 0.26), zb_)]
            poly3("hero_acp_charcoal", P4, [(0, 0), (1, 0), (1, 1), (0, 1)]); poly3("hero_acp_charcoal", P4[::-1], [(0, 0), (1, 0), (1, 1), (0, 1)])
    BANDS = {1: (1.15, "hero_acp_copper"), 2: (1.35, "hero_acp_copper"), 3: (0.95, "hero_acp_white"), 4: (1.05, "hero_acp_grey")}
    def f_a14(sg, k, z0, z1, b_):
        L = sg["L"]
        if sg["front"]:
            bh, bm = BANDS.get(k, (1.0, "hero_acp_grey")); cl, cr = 1.3, 0.5
            WL("hero_acp_charcoal", sg, 0, cl, z0, z1); WL("hero_acp_charcoal", sg, L - cr, L, z0, z1)
            punched(sg, z0, z1, [(cl, L - cr)], z0 + 0.5, z1 - bh, "hero_acp_white", bm, "hero_acp_white", "hero_glass_green", rec=0.36, mull=None, jmat="hero_acp_grey")
            BXs(bm, sg, cl, L - cr, 0.0, 0.14, z1 - bh - 0.04, z1 - bh + 0.0)
        else:
            WL(PLW, sg, 0, L, z0, z1)
            if not sg["side"] or L > 12:     # small windows, on the party walls too (white render, as seen)
                ws = [(a_, b2) for a_, b2 in cols_even(L - 6.0, 0.5, 5.0, 1.8)]; ws = [(a_ + 6.0, b2 + 6.0) for a_, b2 in ws] if sg["side"] else ws
                if sg["side"] and sg["n"][0] < 0: ws = [(L - b2, L - a_) for a_, b2 in ws]
                punched(sg, z0, z1, ws, z0 + 1.0, z0 + 3.1, PLW, PLW, PLW, "hero_glass_teal", rec=0.18, jmat=PLW)
    def f_stilt(sg, k, z0, z1, b_):
        L = sg["L"]
        if sg["front"]:
            WL(PLW, sg, 0, L, z1 - 0.8, z1); BXs(PLW, sg, 0, L, 0.0, 0.3, z1 - 0.8, z1)                # the fascia beam
            WL("hero_acp_charcoal", sg, 0, 1.3, z0, z1 - 0.8)                                            # the dark ACP frame column, left
            for s in (1.9, L / 2, L - 0.5): BXs(PLW, sg, s - 0.3, s + 0.3, -0.6, 0.0, 0.15, z1 - 0.8)    # portal columns
        elif sg["side"]: WL(PLW, sg, 0, L, z0, z1)
        else: WL("hero_dark", sg, 0, L, z0, z1)
    def f_stucco(sg, k, z0, z1, b_):
        L = sg["L"]; W0, W1 = "hero_plaster_cream", "hero_glass_teal"
        if k >= 1: BXs(PLW, sg, 0, L, 0.0, 0.16, z0 - 0.17, z0 + 0.17)                                     # the stucco band at the slab
        if L < 2.0:   # a facet of the round tower: every other one carries a tall slit window
            WL(W0, sg, 0, L, z0, z1)
            if int(round(sg["s0"] * 10)) % 2 == 0 or True: punched(sg, z0, z1, [(L * 0.15, L * 0.85)], z0 + (1.0 if k == 0 else 0.95), z0 + (1.0 if k == 0 else 0.95) + 2.1, W0, W0, W0, W1, rec=0.12)
            return
        if sg["front"] and L > 6:
            bay_e = L * 0.66 if L > 10 else L * 0.6
            WL(PLW, sg, 0, 0.6, z0, z1)
            WL("hero_glass_green", sg, 0.6, bay_e, z0, z1, off=-0.1, vo=z0, u0=sg["s0"] + 0.6)      # one storey of tile per floor, spandrel on the slab line
            BXs(PLW, sg, 0.6, bay_e, -0.1, 0.12, z1 - 0.06, z1 + 0.06)
            WL(W0, sg, bay_e, L, z0, z1)
            rest = [(bay_e + 0.6, bay_e + 0.6 + 1.8)] if L - bay_e > 2.6 + 1.8 else []
            if rest: punched(sg, z0, z1, rest, z0 + (1.0 if k == 0 else 0.95), z0 + (1.0 if k == 0 else 0.95) + 2.1, W0, W0, W0, W1, rec=0.2, jmat=PLW)
            return
        wins = cols_even(L, 1.8, 5.4, 3.6); zz0 = z0 + (1.0 if k == 0 else 0.95); zz1 = zz0 + 2.1      # 3.6 x 2.1 m: two of the teal window units side by side
        punched(sg, z0, z1, wins, zz0, zz1, W0, W0, W0, W1, rec=0.22, jmat=PLW)
        for a_, b2 in wins:    # a stucco sill and lintel to each window
            BXs(PLW, sg, a_ - 0.15, b2 + 0.15, 0.0, 0.2, zz0 - 0.16, zz0 + 0.02); BXs(PLW, sg, a_ - 0.22, b2 + 0.22, 0.0, 0.16, zz1 - 0.02, zz1 + 0.26)
    FKIND = {"podium": f_podium, "punch_dark": f_punch_dark, "glass": f_glass, "white": f_white, "sign": f_sign, "acp": f_acp, "a14": f_a14, "stilt": f_stilt, "stucco": f_stucco, "tower": f_stucco}
    PARAPET = {"podium": (0.0, None), "punch_dark": (0.0, None), "glass": (0.0, None), "white": (1.1, "hero_acp_white"), "sign": (0.4, "hero_acp_white"), "acp": (1.0, "hero_acp_charcoal"),
               "a14": (1.2, PLW), "stilt": (0.0, None), "stucco": (1.0, "hero_plaster_cream"), "tower": (0.0, None)}
    SOFFIT_M = "hero_acp_charcoal"
    def edge_pieces(a, b_, boxes_k):
        L = math.hypot(b_[0] - a[0], b_[1] - a[1])
        if L < 1e-6: return []
        ux, uy = (b_[0] - a[0]) / L, (b_[1] - a[1]) / L; ts = {0.0, round(L, 4)}
        for bb in boxes_k:
            for (px, py) in bb["g"].exterior.coords:
                t = (px - a[0]) * ux + (py - a[1]) * uy
                if 1e-3 < t < L - 1e-3 and abs((px - a[0]) * uy - (py - a[1]) * ux) < 1e-3: ts.add(round(t, 4))
        ts = sorted(ts); out = []
        for t0, t1 in zip(ts, ts[1:]):
            if t1 - t0 < 2e-3: continue
            pa, pb = (a[0] + ux * t0, a[1] + uy * t0), (a[0] + ux * t1, a[1] + uy * t1); mid = Point((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2)
            own = [bb for bb in boxes_k if bb["g"].exterior.distance(mid) < 2e-3]
            out.append((pa, pb, own[-1] if own else boxes_k[-1]))
        return out
    PLANS = [plan(k) for k in range(KMAX + 2)]
    for k in range(KMAX + 1):
        Pk, Pn = PLANS[k], PLANS[k + 1]; z0, z1 = ZB(k), ZT(k); boxes_k = [b for b in BOXES if b["l"][0] <= k < b["l"][1]]
        coll("Building_Facades")
        for pg in polys_of(Pk):
            c = list(orient(pg, 1.0).exterior.coords)
            for a, b_ in zip(c, c[1:]):
                for pa, pb, ob_ in edge_pieces(a, b_, boxes_k):
                    sg = seg_of(pa, pb); FKIND[ob_["kind"]](sg, k, z0, z1, ob_)
                    ph, pm = PARAPET[ob_["kind"]]
                    mid_in = Point((pa[0] + pb[0]) / 2 - sg["n"][0] * 0.3, (pa[1] + pb[1]) / 2 - sg["n"][1] * 0.3)
                    if ph > 0 and not (Pn.contains(mid_in) if not Pn.is_empty else False) and not (ob_.get("no_front_par") and sg["front"]):
                        coll("Rooftops"); WL(pm, sg, 0, sg["L"], z1, z1 + ph); WL("hero_concrete", sg, sg["L"], 0, z1, z1 + ph, off=-0.25) if False else wall("hero_concrete", *PT(sg, sg["L"], -0.25), *PT(sg, 0, -0.25), z1, z1 + ph)
                        HQ(pm if pm != "hero_plaster_cream" else "hero_plaster_white", sg, 0, sg["L"], 0.03, -0.28, z1 + ph + 0.02, up=True)
                        if ob_.get("cornice") or ob_["kind"] == "stucco": BXs(PLW, sg, 0, sg["L"], 0.0, 0.32, z1 + ph - 0.45, z1 + ph - 0.02)
                        coll("Building_Facades")
        # roofs, terraces and soffits between this storey and the one above
        top = Pk.difference(Pn) if not Pn.is_empty else Pk
        coll("Rooftops")
        for rg in polys_of(top):
            terr = any(b_.get("terrace") for b_ in boxes_k if b_["g"].buffer(1e-3).contains(rg.representative_point()))
            flat("hero_pavers" if terr else "hero_roof", rg, z1 + 0.04 if terr else z1 + 0.02)
            if terr:   # planters along the terrace's exterior edge, inside the parapet
                coll("Landscaping")
                for ls in [l_ for l_ in [rg.exterior] if l_.length > 4]:
                    cc = list(ls.coords)
                    for a, b_ in zip(cc, cc[1:]):
                        if not Pk.exterior.buffer(0.05).contains(Point((a[0] + b_[0]) / 2, (a[1] + b_[1]) / 2)) and not any(g_.exterior.buffer(0.05).contains(Point((a[0] + b_[0]) / 2, (a[1] + b_[1]) / 2)) for g_ in polys_of(Pk)): continue
                        sg = seg_of(a, b_)
                        if sg["L"] < 3: continue
                        BXs("hero_stone", sg, 0.4, sg["L"] - 0.4, -1.25, -0.55, z1 + 0.04, z1 + 0.62, top=False)
                        HQ("hero_mulch", sg, 0.4, sg["L"] - 0.4, -0.55, -1.25, z1 + 0.62, up=True)
                        for s in np.arange(1.0, sg["L"] - 0.8, 1.7):
                            px_, py_ = PT(sg, s, -0.9); coll("Vegetation"); (shrub("leaf_shrub", px_, py_, z1 + 0.62, RND.uniform(0.45, 0.65), 9) if RND.random() < 0.7 else clump("leaf_grass", px_, py_, z1 + 0.62, RND.uniform(0.8, 1.1), 0.9)); coll("Landscaping")
                coll("Rooftops")
        if not Pn.is_empty:
            soff = Pn.difference(Pk)
            if not soff.is_empty: coll("Architecture"); flat(SOFFIT_M, soff, z1 - 0.01, up=False)
    ROOFTOP_Z = ZT(KMAX)


# ------------------------------------------------------------------ per-family extras: entrances, crowns, towers, scaffolding, roof plant
if not LEGACY:
    STILT, Z0, PORTAL, CW, CD, CZ = False, 0.0, 8.0, 8.0, 3.0, 3.6
    def box_of(kind): return next((b_ for b_ in BOXES if b_["kind"] == kind), None)
    def roof_plant(items):
        coll("Rooftops")
        for it in items:
            z_ = ZT(it.get("level", NF)); cx_, cy_ = X0 + it["x"], YF + it["y"]
            if it.get("shape") == "tank": cyl("tank", cx_, cy_, z_, z_ + it["h"], it["w"] / 2, 16)
            else: bx(it.get("mat", "hero_acp_charcoal"), cx_, cy_, z_, z_ + it["h"], it["w"], it["d"])
    if FAM == "magnus":
        STILT = False
        ENTR = [{"x": X0 + (bb["x"][0] + bb["x"][1]) / 2, "w": bb["x"][1] - bb["x"][0] + 4.0, "d": 7.0} for bb in SP.get("bays", []) if bb["kind"] == "portal"]
        sb = box_of("sign")
        if sb:
            minx, miny, maxx, maxy = sb["g"].bounds; LABELS.append((SP.get("sign", "MAGNUS GREENS"), (minx + maxx) / 2, miny - 0.04, ZB(KMAX) + FH * 0.62, 0.62))
        pg_ = SP.get("pergola")
        if pg_:      # a timber pergola on the roof terrace: posts, beams and cross rafters
            coll("Rooftops"); zp = ZT(pg_["level"]); xa, xb = X0 + pg_["x"][0], X0 + pg_["x"][1]; ya, yb2 = YF + pg_["y"][0], YF + pg_["y"][1]; hh = 3.0
            for xx in np.linspace(xa, xb, 5):
                for yy in (ya, yb2): bx("hero_bark", xx, yy, zp, zp + hh, 0.22, 0.22)
            for yy in (ya, yb2): bx("hero_bark", (xa + xb) / 2, yy, zp + hh, zp + hh + 0.28, xb - xa + 0.6, 0.2)
            for xx in np.arange(xa, xb + 0.01, 0.55): bx("hero_bark", xx, (ya + yb2) / 2, zp + hh + 0.28, zp + hh + 0.4, 0.1, yb2 - ya + 0.8)
        roof_plant(SP.get("plant", []))
        NAME_SPOT = False
    elif FAM == "acp":     # A104: a canopy over the entrance on the lane face, a stair headroom on an otherwise bare roof
        STILT = False; PORTAL = 6.0; CW, CD, CZ = 8.0, 3.0, 3.7
        ENTR = [{"x": SP.get("entrance_x", 0.0), "w": CW, "d": CD}]
        coll("Architecture"); ex_ = ENTR[0]["x"]
        bx("hero_acp_charcoal", ex_, YF - CD / 2, CZ, CZ + 0.4, CW, CD); bx("hero_dark", ex_, YF - CD / 2, CZ - 0.04, CZ, CW - 0.2, CD - 0.2, top=False, bottom=True)
        for sx in (-CW / 2 + 0.3, CW / 2 - 0.3): bx("hero_rail", ex_ + sx, YF - CD + 0.3, 0.0, CZ, 0.16, 0.16)
        for k_ in range(3): bx("hero_concrete", ex_, YF - 0.5 - k_ * 0.35, 0.0, 0.45 - k_ * 0.15, 6.0, 0.35)
        bx("hero_lobby_glass", ex_, YF + 0.0, 0.0, CZ, 5.0, 0.04, top=False)
        NAME_SPOT = (ex_, YF - CD - 0.02, CZ + 0.02, 0.5)
        roof_plant(SP.get("plant", []))
    elif FAM == "a14":
        STILT, Z0 = True, 0.15; PORTAL = 6.0; CW, CD, CZ = 6.0, 2.4, 3.4
        ENTR = [{"x": 0.0, "w": 6.0, "d": 2.4}]
        coll("Architecture")
        flat("hero_concrete", box(X0, YF, X1, YB), Z0 + 0.01); flat("hero_concrete", box(X0, YF, X1, YB), GH - 0.02, up=False)      # the stilt's floor and its soffit
        bx(PLW, X1 - 3.4, YB - 3.0, 0.0, GH, 6.4, 5.8)                                                       # the stair and lift core at the back of the stilt
        bx("hero_lobby_glass", X1 - 3.4, YB - 6.0, 0.0, GH - 0.8, 3.2, 0.04, top=False)
        coll("Building_Facades")
        # the dark grey ACP crown with the angled white cornice
        zc = H; ch = 2.9
        wall("hero_acp_grey", X0, YF, X1, YF, zc, zc + ch); wall("hero_acp_grey", X0, YF + 3.4, X0, YF, zc, zc + ch); wall("hero_acp_grey", X1, YF, X1, YF + 3.4, zc, zc + ch)
        wall("hero_acp_grey", X1, YF + 0.25, X0, YF + 0.25, zc, zc + ch)
        zl, zr = zc + ch + 0.5, zc + ch + 0.05
        top_ = [(X0 - 0.15, YF - 0.65, zl), (X1 + 0.15, YF - 0.65, zr), (X1 + 0.15, YF + 3.5, zr - 0.1), (X0 - 0.15, YF + 3.5, zl - 0.1)]
        poly3("hero_acp_white", top_, [(p[0] / 3.6, p[1] / 3.0) for p in top_])
        und = [(p[0], p[1], p[2] - 0.22) for p in top_][::-1]; poly3("hero_acp_copper", und, [(p[0] / 3.6, p[1] / 3.0) for p in und])      # the copper-toned soffit under the cornice
        for (p, q) in ((top_[0], top_[1]), (top_[1], top_[2]), (top_[2], top_[3]), (top_[3], top_[0])):
            poly3("hero_acp_white", [(p[0], p[1], p[2] - 0.22), (q[0], q[1], q[2] - 0.22), q, p], [(0, 0), (1, 0), (1, 0.08), (0, 0.08)])
        sc = SP.get("scaffold")
        if sc:      # bamboo-and-pole scaffolding at the left edge of the front, as in the 2026 imagery: poles, ledgers, boards
            coll("Street_Infrastructure"); xs0, xs1 = X0 + sc["x"][0], X0 + sc["x"][1]; zs_top = ZT(sc.get("levels", 2)) + 1.5
            rows = (YF - 0.5, YF - 1.9)
            for yy in rows:
                for xx in np.arange(xs0, xs1 + 0.01, 1.8): bx("hero_bark", xx, yy, 0.1, zs_top, 0.07, 0.07, top=False)
                for zz in np.arange(2.0, zs_top, 2.0): bx("hero_bark", (xs0 + xs1) / 2, yy, zz, zz + 0.06, xs1 - xs0, 0.06)
            for xx in np.arange(xs0, xs1 + 0.01, 1.8):
                for zz in np.arange(2.0, zs_top, 2.0): bx("hero_bark", xx, (rows[0] + rows[1]) / 2, zz, zz + 0.06, 0.06, rows[0] - rows[1])
            for zz in np.arange(4.0, zs_top, 4.0): bx("hero_bark", (xs0 + xs1) / 2, (rows[0] + rows[1]) / 2, zz + 0.06, zz + 0.1, xs1 - xs0, rows[0] - rows[1])
            for i in range(int((zs_top - 0.1) // 2.0)):     # diagonal braces on the front plane
                z_a = 0.1 + i * 2.0; z_b = z_a + 2.0
                poly3("hero_bark", [(xs0, rows[0], z_a), (xs0 + 0.06, rows[0], z_a), (xs1 + 0.06, rows[0], z_b), (xs1, rows[0], z_b)], [(0, 0)] * 4) if i % 2 == 0 else None
        roof_plant(SP.get("plant", []))
        NAME_SPOT = (0.0, YF - CD - 0.02, CZ + 0.02, 0.45)
        coll("Architecture")
        bx(PLW, 0.0, YF - CD / 2, CZ, CZ + 0.35, CW, CD)
        for sx in (-CW / 2 + 0.3, CW / 2 - 0.3): bx("hero_rail", sx, YF - CD + 0.3, Z0, CZ, 0.14, 0.14)
    elif FAM == "stucco":
        STILT = False; PORTAL = 6.0; CW, CD, CZ = 6.0, 3.0, 3.4
        tb = box_of("tower"); tcx, tcy = tb["g"].centroid.coords[0]; R = tb["tower"]["r"]
        ex_ = Tinv(*REF["gates"][1])[0] if len(REF.get("gates", [])) > 1 else -W * 0.3
        ENTR = [{"x": ex_, "w": CW, "d": CD}]
        coll("Rooftops")      # the glazed drum, its cap and the ring cornice of the round corner tower
        cyl(PLW, tcx, tcy, H, H + 0.5, R + 0.4, 20, top=True); cyl("hero_glass_green", tcx, tcy, H + 0.5, H + 2.5, R - 0.55, 20, top=False)
        for a_ in np.linspace(0, math.tau, 12, endpoint=False): bx("hero_mullion", tcx + (R - 0.52) * math.cos(a_), tcy + (R - 0.52) * math.sin(a_), H + 0.5, H + 2.5, 0.07, 0.07)
        cyl(PLW, tcx, tcy, H + 2.5, H + 3.0, R + 0.3, 20, top=True)
        coll("Architecture")
        bx(PLW, ex_, YF - CD / 2, CZ, CZ + 0.3, CW, CD)
        for sx in (-CW / 2 + 0.3, CW / 2 - 0.3): bx(PLW, ex_ + sx, YF - CD + 0.3, 0.0, CZ, 0.3, 0.3)
        NAME_SPOT = (ex_, YF - CD - 0.02, CZ + 0.02, 0.45)
        roof_plant(SP.get("plant", []))

# ------------------------------------------------------------------ the plot
if GRADE_A: STILT, Z0 = False, 0.45
if LEGACY: ENTR = [{"x": 0.0, "w": CW, "d": CD}]
# the plot: the spec's refs entry may carry the surveyed/traced plot ("plot", scene metres, the building standing inside it); otherwise the building's outline grown by plot_buffer
explicit_plot = bool(REF.get("plot"))
plot_raw = Polygon(REF["plot"]).buffer(0) if explicit_plot else foot.buffer(SP.get("plot_buffer", 10.5), join_style="mitre")
plot_scene = plot_raw.difference(roads.buffer(0.3 if explicit_plot else 1.5)).buffer(-0.01)
plot_scene = max(getattr(plot_scene, "geoms", [plot_scene]), key=lambda g: g.area)
others = [Polygon(b["p"]).buffer(0) for b in S["buildings"] if not b.get("opt") and Polygon(b["p"]).distance(foot) < 30 and not Polygon(b["p"]).intersects(foot)]
if others: plot_scene = plot_scene.difference(unary_union(others).buffer(0.3 if explicit_plot else 1.5)); plot_scene = max(getattr(plot_scene, "geoms", [plot_scene]), key=lambda g: g.area)
plot = Polygon([Tinv(*p) for p in plot_scene.exterior.coords]).simplify(0.3)
B = Polygon([(X0, YF), (X1, YF), (X1, YB), (X0, YB)])
plot = unary_union([plot, B.buffer(0.5, join_style="mitre")]); plot = max(getattr(plot, "geoms", [plot]), key=lambda g: g.area)    # the building always stands inside its own plot
walk_z, drive_z = 0.16, 0.04
inner_plot = plot.buffer(-SP.get("inner_inset", 2.6), join_style="mitre")
if inner_plot.is_empty: inner_plot = plot.buffer(-0.6, join_style="mitre")
inner_plot = max(getattr(inner_plot, "geoms", [inner_plot]), key=lambda g: g.area)
walkway = B.buffer(3.2, join_style="mitre").difference(B.buffer(0.6, join_style="mitre"))
beds = B.buffer(1.8, join_style="mitre").difference(B.buffer(0.6, join_style="mitre")).difference(unary_union([box(e["x"] - PORTAL / 2 - 4, YF - 8, e["x"] + PORTAL / 2 + 4, YF + 1) for e in ENTR]))
if STILT: beds = beds.intersection(box(X0 - 3, YB - 0.1, X1 + 3, YB + 3))   # a stilt is driven into from the front and sides: beds at the back only
forecourt = unary_union([box(e["x"] - e["w"] / 2 - 1, YF - e["d"] - 1.5, e["x"] + e["w"] / 2 + 1, YF - 0.6) for e in ENTR])
drive = inner_plot.difference(B.buffer(3.2, join_style="mitre")).difference(forecourt)
strip = plot.difference(inner_plot)
GATE_W = SP.get("gate_w", 7.0); GATE_H = SP.get("gate_h", 1.9)
bound = plot.exterior
gate_x = tuple(s * max(CW / 2 + 1 + 3.5 + 1.0, W / 2 - 9.0) for s in (-1, 1))
GATES = []     # {"x","y": on the boundary; "ang": the boundary's direction; "in": the unit vector into the plot}: from the refs' scene-metre gates when given, else two on the road face
def _gate_at(pt):
    d_ = bound.project(pt); q = bound.interpolate(d_); a = bound.interpolate(max(0.0, d_ - 0.6)); b2 = bound.interpolate(min(bound.length, d_ + 0.6)); ang = math.atan2(b2.y - a.y, b2.x - a.x)
    inn = (-math.sin(ang), math.cos(ang))
    if not plot.contains(Point(q.x + inn[0] * 1.0, q.y + inn[1] * 1.0)): inn = (-inn[0], -inn[1])
    return {"x": q.x, "y": q.y, "ang": ang, "in": inn}
if REF.get("gates"): GATES = [_gate_at(Point(*Tinv(*g))) for g in REF["gates"]]
else: GATES = [_gate_at(Point(gx, YF - 20)) for gx in gate_x]
WALL = {"base": 0.95, "rail": 1.95, "pillar": 3.2, "mat": "parapet", "pmat": "hero_stone", "wire": False}; WALL.update(SP.get("wall", {}))
FS_Y = SP.get("front_strip_y", 3.5)
front_strip = strip.intersection(box(X0 - 40, YF - 40, X1 + 40, YF - FS_Y))
# layered planting along the road boundary (grasses at the back, shrubs, flowers at the front), in a bed whose
# inner edge curves; the rest of the road-side strip is lawn
fb_line = [bound.interpolate(d) for d in np.arange(0.0, bound.length, 1.0)]
fb_pts = [p for p in fb_line if p.y < YF - FS_Y and not any(math.hypot(p.x - g["x"], p.y - g["y"]) < GATE_W / 2 + 1.5 for g in GATES)]
front_bed = unary_union([p.buffer(1.3 + 0.8 * math.sin(i / 3.1) + 0.3 * math.sin(i / 1.7)) for i, p in enumerate(fb_pts)]).intersection(front_strip) if fb_pts else Polygon()
coll("Landscaping")
flat("hero_pavers", walkway.difference(beds).union(forecourt.intersection(plot)), walk_z)   # interlocking pavers: cars cross them to a stilt
flat("hero_mulch", beds, walk_z - 0.02)
flat("hero_lawn", front_strip.difference(front_bed), 0.06); flat("hero_mulch", front_bed, 0.07); flat("hero_mulch", strip.difference(front_strip), 0.06)
for g in getattr(walkway.union(forecourt).buffer(0), "geoms", [walkway.union(forecourt).buffer(0)]):
    ribbon("kerb", LineString(list(g.exterior.coords)), drive_z, walk_z, both=False)
coll("Street_Infrastructure")
flat("hero_asphalt", drive, drive_z)
# parking: parallel bays (2.5 x 6 m) marked along the outer edge of the side and back drives
def marks_along(line, step, lane_w):
    L_ = line.length; out = []
    for d in np.arange(3.0, L_ - 3.0, step):
        p = line.interpolate(d); q = line.interpolate(min(L_, d + 0.5)); dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n; out.append(((p.x, p.y), (p.x + nx * lane_w, p.y + ny * lane_w)))
    return out
for (a_, b_) in marks_along(inner_plot.exterior, 6.0, 2.5):
    mid = Point((a_[0] + b_[0]) / 2, (a_[1] + b_[1]) / 2)
    if not drive.buffer(-0.2).contains(mid) or mid.y < YF - 2: continue
    dx, dy = b_[0] - a_[0], b_[1] - a_[1]; L_ = math.hypot(dx, dy); tx, ty = -dy / L_ * 0.06, dx / L_ * 0.06
    poly3("marking", [(a_[0] - tx, a_[1] - ty, drive_z + 0.01), (a_[0] + tx, a_[1] + ty, drive_z + 0.01), (b_[0] + tx, b_[1] + ty, drive_z + 0.01), (b_[0] - tx, b_[1] - ty, drive_z + 0.01)], [(0, 0)] * 4)
# a covered basement ramp on the back drive (every option has a basement), where it fits
rx, ry = None, None
for cx_ in (X0 + 9.0, X1 - 9.0, 0.0):
    if inner_plot.buffer(0.5).contains(box(cx_ - 2.4, YB + 1.5, cx_ + 2.4, YB + 10.5)): rx, ry = cx_, YB + 6.0; break
if rx is not None:
    for sx in (-2.1, 2.1): bx("hero_concrete", rx + sx, ry, 0.0, 1.1, 0.25, 9.0)
    bx("hero_concrete", rx, ry - 3.0, 2.8, 3.2, 4.8, 3.2, bottom=True)
    for sx in (-2.1, 2.1): bx("hero_concrete", rx + sx, ry - 3.0, 0.0, 2.8, 0.3, 0.3)
    hquad("hero_dark", rx - 1.95, ry - 4.4, rx + 1.95, ry + 4.4, drive_z + 0.02)
else: print("no room for a basement ramp on the back drive; left out")
# boundary wall with railing and pillars, gates on the road face
def in_gate(p): return any(math.hypot(p.x - g["x"], p.y - g["y"]) < GATE_W / 2 for g in GATES)
segs = []
cc = list(bound.coords)
for (ax_, ay_), (bx2, by2) in zip(cc, cc[1:]):
    L_ = math.hypot(bx2 - ax_, by2 - ay_); n = max(1, int(L_ / 0.5)); cur = None
    for k in range(n + 1):
        t = k / n; p = Point(ax_ + (bx2 - ax_) * t, ay_ + (by2 - ay_) * t)
        if in_gate(p):
            if cur and len(cur) > 1: segs.append(cur)
            cur = None
        else: cur = (cur or []) + [(p.x, p.y)]
    if cur and len(cur) > 1: segs.append(cur)
for sg in segs:
    ls = LineString(sg)
    if ls.length < 0.3: continue
    hb, hr = WALL["base"], WALL["rail"]
    ribbon(WALL["mat"], ls, 0.0, hb)
    c = list(ls.coords)
    for (ax_, ay_), (bx2, by2) in zip(c, c[1:]):
        L_ = math.hypot(bx2 - ax_, by2 - ay_); ang_ = math.atan2(by2 - ay_, bx2 - ax_)
        bx("hero_concrete", (ax_ + bx2) / 2, (ay_ + by2) / 2, hb, hb + 0.07, L_ + 0.02, 0.3, ang_)   # coping
        if hr: bx("hero_rail", (ax_ + bx2) / 2, (ay_ + by2) / 2, hr, hr + 0.05, L_, 0.05, ang_, bottom=True)
        if WALL.get("wire"):    # barbed wire along the top of a solid wall
            for dz_ in (0.2, 0.38, 0.56): bx("hero_rail", (ax_ + bx2) / 2, (ay_ + by2) / 2, hb + dz_, hb + dz_ + 0.014, L_, 0.014, ang_, top=False)
    if hr:
        for d in np.arange(0.0, ls.length, 0.16):
            p = ls.interpolate(d); bx("hero_rail", p.x, p.y, hb + 0.07, hr, 0.022, 0.022, top=False)
    if WALL["pillar"]:
        ph_ = (hr or hb + (0.6 if WALL.get("wire") else 0.0)) + 0.2
        for d in np.arange(0.0, ls.length + 0.01, WALL["pillar"]):
            p = ls.interpolate(min(d, ls.length)); bx(WALL["pmat"], p.x, p.y, 0.0, ph_, 0.45, 0.45); bx("hero_concrete", p.x, p.y, ph_, ph_ + 0.1, 0.55, 0.55)
# gates (sliding mild-steel panels, half open), guard cabin, boom barrier
for g in GATES:
    gx, gy, ga = g["x"], g["y"], g["ang"]; tx, ty = math.cos(ga), math.sin(ga); ix, iy = g["in"]
    for sgn in (-1, 1):
        px_, py_ = gx + tx * sgn * GATE_W / 2, gy + ty * sgn * GATE_W / 2
        bx(WALL["pmat"], px_, py_, 0.0, GATE_H + 0.7, 0.6, 0.6, ga); bx("hero_concrete", px_, py_, GATE_H + 0.7, GATE_H + 0.82, 0.7, 0.7, ga)
    cx_, cy_ = gx - tx * (GATE_W / 2 + 1.2) + ix * 0.4, gy - ty * (GATE_W / 2 + 1.2) + iy * 0.4          # the leaf, slid half open along the wall
    bx("hero_rail", cx_, cy_, 0.1, GATE_H, 3.6, 0.06, ga)
    for k in range(18):
        sx_ = -GATE_W / 2 - 2.9 + k * 0.2; bx("hero_rail", gx + tx * sx_ + ix * 0.4, gy + ty * sx_ + iy * 0.4, 0.15, GATE_H - 0.05, 0.03, 0.03, ga, top=False)
HUT = SP.get("hut", 0 if LEGACY else None); cbx = cby = None
if HUT is not None and GATES:
    g = GATES[HUT]; gx, gy, ga = g["x"], g["y"], g["ang"]; tx, ty = math.cos(ga), math.sin(ga); ix, iy = g["in"]
    for side in (1, -1):
        hx_, hy_ = gx + tx * side * (GATE_W / 2 + 3.2) + ix * 1.6, gy + ty * side * (GATE_W / 2 + 3.2) + iy * 1.6
        if plot.buffer(-0.4).contains(Point(hx_, hy_)) and not B.buffer(1.5).intersects(Point(hx_, hy_).buffer(1.6)) and not any(Point(hx_, hy_).distance(Point(e["x"], YF - e["d"] / 2)) < e["w"] / 2 + 3 for e in ENTR if LEGACY): cbx, cby = hx_, hy_; break
    if cbx is not None:
        bx("hero_concrete", cbx, cby, 0.0, 2.9, 2.6, 2.4, ga); bx("hero_lobby_glass", cbx - tx * side * 1.31, cby - ty * side * 1.31, 1.0, 2.3, 0.02, 2.0, ga, top=False); bx("hero_alu", cbx, cby, 2.9, 3.1, 3.4, 3.2, ga, bottom=True)
        if LEGACY: bx("boom", gx + tx * (GATE_W / 2 - 0.4) + ix * 2.0, gy + ty * (GATE_W / 2 - 0.4) + iy * 2.0, 0.0, 1.0, 0.35, 0.35, ga); bx("ad_white", gx + ix * 2.0, gy + iy * 2.0, 0.95, 1.05, GATE_W - 1.0, 0.08, ga, bottom=True)
if cbx is None: cbx, cby = 1e9, 1e9
# lights: poles along the drive, bollards along the walkway
for d in np.arange(4.0, inner_plot.exterior.length, 16.0):
    p = inner_plot.exterior.interpolate(d)
    if any(math.hypot(p.x - g["x"], p.y - g["y"]) < GATE_W for g in GATES): continue
    cyl("hero_rail", p.x, p.y, 0.0, 6.0, 0.07, 8, top=False); bx("hero_rail", p.x, p.y, 6.0, 6.15, 0.9, 0.25); hquad("lobby_light", p.x - 0.4, p.y - 0.1, p.x + 0.4, p.y + 0.1, 5.99, up=False)
wo = B.buffer(3.2, join_style="mitre").exterior
for d in np.arange(2.0, wo.length, 6.0):
    p = wo.interpolate(d)
    if p.y < YF - 0.5 and any(abs(p.x - e["x"]) < e["w"] / 2 + 1.5 for e in ENTR): continue
    if STILT and p.y < YB: continue
    cyl("hero_rail", p.x, p.y, walk_z, walk_z + 0.9, 0.09, 10); cyl("lobby_light", p.x, p.y, walk_z + 0.78, walk_z + 0.86, 0.095, 10, top=False)

# ------------------------------------------------------------------ planting: hedges, shrubs, layered beds, bougainvillea (trees go to the site file)
coll("Vegetation")
# a hedge inside the boundary wall on the sides and back (the road side has the layered bed)
for sg in segs:
    ls = LineString(sg)
    if ls.length < 2: continue
    off = ls.parallel_offset(1.0, "left" if plot.exterior.is_ccw else "right")
    for g in getattr(off, "geoms", [off]):
        if g.length > 1.5 and plot.buffer(-0.4).contains(g.centroid) and not front_bed.buffer(0.5).contains(g.centroid): hedge_along(g.simplify(0.3), 0.8, 1.1)
# the layered bed: plants by distance from the wall
for g in getattr(front_bed, "geoms", [front_bed]):
    if g.is_empty or g.area < 1: continue
    minx, miny, maxx, maxy = g.bounds
    for _ in range(int(g.area * 1.1)):
        p = Point(RND.uniform(minx, maxx), RND.uniform(miny, maxy))
        if not g.buffer(-0.25).contains(p): continue
        dw = bound.distance(p)   # 0 at the wall
        if dw < 0.9: clump("leaf_grass", p.x, p.y, 0.07, RND.uniform(0.9, 1.3), RND.uniform(0.9, 1.2))
        elif dw < 1.7: shrub("leaf_shrub", p.x, p.y, 0.07, RND.uniform(0.45, 0.7), 10)
        else: shrub("leaf_flower", p.x, p.y, 0.07, RND.uniform(0.35, 0.5), 9, tall=0.7)
# shrubs and flowers in the beds round the building; grasses at the corners
bl = B.buffer(1.2, join_style="mitre").exterior
for i, d in enumerate(np.arange(1.0, bl.length, 2.2)):
    p = bl.interpolate(d)
    if not beds.contains(p): continue
    if abs(p.y - YF) < 4 and any(abs(p.x - e["x"]) < e["w"] / 2 + 12 for e in ENTR): shrub("leaf_flower", p.x, p.y, walk_z, RND.uniform(0.4, 0.55), 10, tall=0.7)
    elif i % 5 == 0: clump("leaf_grass", p.x, p.y, walk_z, 1.1, 1.0)
    else: shrub("leaf_shrub", p.x, p.y, walk_z, RND.uniform(0.6, 0.9))
# raised planters flanking the entrance, with flowers
for e in ENTR:
    for sx in (-1, 1):
        px_ = e["x"] + sx * (e["w"] / 2 + 0.2); py_ = YF - e["d"] - 0.4
        if not plot.buffer(-0.3).contains(Point(px_, py_)): continue
        coll("Landscaping"); bx("hero_stone", px_, py_, walk_z, walk_z + 0.55, 1.6, 1.6, mats=("hero_stone", "hero_mulch"))
        coll("Vegetation"); shrub("leaf_flower", px_, py_, walk_z + 0.55, 0.6, 14, tall=0.7)
# bougainvillea at the gate pillars
for g in GATES:
    tx, ty = math.cos(g["ang"]), math.sin(g["ang"])
    if SP.get("bougainvillea", LEGACY):
        for sx in (-GATE_W / 2 - 1.4, GATE_W / 2 + 1.4): shrub("leaf_bloom", g["x"] + tx * sx + g["in"][0] * 0.9, g["y"] + ty * sx + g["in"][1] * 0.9, 0.06, 1.3, 22)
# trees for the site file: ashoka along the road boundary, neem along the others, palms at the forecourt
trees = []
inner_ring = plot.buffer(-1.6, join_style="mitre").exterior
for d in np.arange(2.0, inner_ring.length, 1.0):
    p = inner_ring.interpolate(d)
    if any(math.hypot(p.x - g["x"], p.y - g["y"]) < GATE_W / 2 + 2.5 for g in GATES): continue
    if B.buffer(2.0).contains(p): continue
    front_side = p.y < YF - FS_Y + 0.5
    step = 4.5 if front_side else 9.0
    if trees and min(math.hypot(p.x - t[0], p.y - t[1]) for t in trees) < step: continue
    if rx is not None and abs(p.x - rx) < 4 and abs(p.y - ry) < 7: continue
    if front_side and any(abs(p.x - e["x"]) < e["w"] / 2 + 5 for e in ENTR): continue      # keep the view to the entrance open
    if abs(p.x - cbx) < 3 and abs(p.y - cby) < 3: continue
    trees.append((p.x, p.y, 1 if front_side else 0, RND.uniform(0.85, 1.15) if front_side else RND.uniform(0.8, 1.1)))
if LEGACY:
    for sx in (-CW / 2 - 2.5, CW / 2 + 2.5):
        for k in range(2): trees.append((sx, YF - 1.5 - k * 4.5, 2, RND.uniform(0.9, 1.05)))
# a tree belt outside the wall, between it and the road (Magnus: a dense belt of neem, ashoka and others ~30 m deep), on open ground only
TB = SP.get("tree_belt")
if TB:
    blds_all = unary_union([Polygon(b["p"]).buffer(1.0) for b in S["buildings"] if Polygon(b["p"]).distance(foot) < 160 and not b.get("opt")])
    roads_b = roads.buffer(2.2); belt = []
    for dy, step, jit in TB["rows"]:
        for xx in np.arange(X0 - TB.get("pad", 14.0), X1 + TB.get("pad", 14.0), step):
            lx, ly = xx + RND.uniform(-jit, jit) + (step / 2 if int(dy) % 2 else 0), YF - dy + RND.uniform(-jit, jit)
            sp_ = Point(*T(lx, ly))
            if roads_b.contains(sp_) or blds_all.contains(sp_) or plot.buffer(0.8).contains(Point(lx, ly)): continue
            if any(math.hypot(lx - g["x"], ly - g["y"]) < GATE_W for g in GATES): continue
            if belt and min(math.hypot(lx - q[0], ly - q[1]) for q in belt) < step * 0.6: continue
            belt.append((lx, ly)); trees.append((lx, ly, 1 if RND.random() < 0.3 else 0, RND.uniform(0.85, 1.25)))
    print("tree belt", len(belt), "trees")
print("site trees", len(trees), "plot", round(plot.area), "m2")

# ------------------------------------------------------------------ Blender: collections, materials, cameras, export
import bpy, mathutils
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.unit_settings.system = "METRIC"
def hexc(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)
MATDEF = {   # name: (colour, roughness, metallic, texture, emission)   the page loads its own textures by material name
    "hero_glass": ("#2e3c46", 0.06, 0.35, "hero_glass", None), "hero_spandrel": ("#32373c", 0.15, 0.4, "hero_spandrel", None),
    "hero_alu": ("#bdb19a", 0.32, 0.65, "hero_alu", None), "hero_stone": ("#c4b08e", 0.62, 0.0, "hero_stone", None),
    "hero_concrete": ("#b4b2ac", 0.8, 0.0, "hero_concrete", None), "hero_roof": ("#a8aaa8", 0.75, 0.0, "hero_roof", None),
    "hero_pavers": ("#9a9894", 0.85, 0.0, "hero_pavers", None), "hero_asphalt": ("#46464a", 0.9, 0.0, "hero_asphalt", None),
    "hero_lawn": ("#5f8a3a", 0.92, 0.0, "hero_lawn", None), "hero_mulch": ("#5e4430", 0.95, 0.0, "hero_mulch", None),
    "hero_plaster": ("#e2dcce", 0.88, 0.0, "hero_plaster", None), "hero_plaster_b": ("#b0a696", 0.88, 0.0, "hero_plaster_b", None),
    "hero_hedge": ("#3f6a2c", 0.9, 0.0, "leaves_shrub", None), "hero_mullion": ("#2e3236", 0.35, 0.8, None, None),
    "hero_hvac": ("#b8bcbe", 0.45, 0.6, None, None), "hero_solar": ("#1c2a44", 0.12, 0.3, None, None), "hero_dark": ("#121416", 0.9, 0.0, None, None),
    "hero_rail": ("#2a2c2e", 0.4, 0.8, None, None), "hero_lobby_glass": ("#9cb4bc", 0.03, 0.1, None, None), "hero_bark": ("#5a4a3a", 0.9, 0.0, "hero_bark", None),
    "lobby_ceiling": ("#efede8", 0.8, 0.0, None, None), "lobby_light": ("#fff4e0", 0.5, 0.0, None, ("#fff1d6", 6.0)),
    "kerb": ("#bdb8ab", 0.85, 0.0, None, None), "marking": ("#eeeee6", 0.6, 0.0, None, None), "parapet": ("#d9d3c4", 0.85, 0.0, None, None),
    "tank": ("#1d1f22", 0.5, 0.0, None, None), "boom": ("#d23b2c", 0.4, 0.0, None, None), "ad_white": ("#efefea", 0.5, 0.0, None, None),
    "leaf_shrub": ("#4a7a34", 0.8, 0.0, "leaves_shrub", None), "leaf_bloom": ("#4a7a34", 0.8, 0.0, "leaves_bloom", None),
    "leaf_grass": ("#7a8c44", 0.8, 0.0, "leaves_grass", None), "leaf_flower": ("#5a8a3c", 0.8, 0.0, "leaves_flower", None),
    "leaf": ("#4c7a30", 0.8, 0.0, "leaves_a", None), "leaf_b": ("#3c6a2c", 0.8, 0.0, "leaves_b", None), "leaf_palm": ("#5a8a3a", 0.8, 0.0, "leaves_palm", None),
    # the JindalX facade set: colours are the fallback (and the Blender base) when a texture is missing; the page maps these names to its own tex/ sets
    "hero_acp_white": ("#e4e6e5", 0.38, 0.3, "hero_acp_white", None), "hero_acp_charcoal": ("#34383b", 0.4, 0.3, "hero_acp_charcoal", None),
    "hero_acp_copper": ("#8f5b3a", 0.38, 0.7, "hero_acp_copper", None), "hero_acp_grey": ("#4a4f54", 0.4, 0.4, "hero_acp_grey", None),
    "hero_glass_dark": ("#1d2a35", 0.05, 0.3, "hero_glass_dark", None), "hero_glass_bluegrey": ("#4b6579", 0.05, 0.3, "hero_glass_bluegrey", None),
    "hero_glass_green": ("#4f8672", 0.05, 0.3, "hero_glass_green", None), "hero_glass_teal": ("#3f8c8a", 0.05, 0.25, "hero_glass_teal", None),
    "hero_plaster_cream": ("#e6dab8", 0.9, 0.0, "hero_plaster_cream", None), "hero_plaster_white": ("#ecebe6", 0.9, 0.0, "hero_plaster_white", None),
    "opt_name": ("#ffffff", 0.4, 0.0, None, ("#fff2da", 1.0)), "ground_noida": ("#a89a80", 0.95, 0.0, "ground_noida", None),
}
MATS = {}
def mat(name):
    if name in MATS: return MATS[name]
    col, rough, metal, texn, emit = MATDEF.get(name, ("#9a9a9a", 0.8, 0.0, None, None))
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hexc(col); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if texn:
        ext = ".png" if texn.startswith("leaves") else ".jpg"; p = os.path.abspath(os.path.join(TEX, texn + ext))
        if os.path.exists(p):
            im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(p, check_existing=True); nt.links.new(im.outputs["Color"], b.inputs["Base Color"])
            if texn.startswith("leaves") and name.startswith("leaf"):
                nt.links.new(im.outputs["Alpha"], b.inputs["Alpha"])
                try: m.surface_render_method = "DITHERED"
                except Exception: pass
            rp = os.path.join(TEX, texn + "_r.jpg")
            if os.path.exists(rp):
                ri = nt.nodes.new("ShaderNodeTexImage"); ri.image = bpy.data.images.load(os.path.abspath(rp), check_existing=True); ri.image.colorspace_settings.name = "Non-Color"
                sep = nt.nodes.new("ShaderNodeSeparateColor"); nt.links.new(ri.outputs["Color"], sep.inputs[0]); nt.links.new(sep.outputs[1], b.inputs["Roughness"])
            np_ = os.path.join(TEX, texn + "_n.jpg")
            if os.path.exists(np_):
                ni = nt.nodes.new("ShaderNodeTexImage"); ni.image = bpy.data.images.load(os.path.abspath(np_), check_existing=True); ni.image.colorspace_settings.name = "Non-Color"
                nm = nt.nodes.new("ShaderNodeNormalMap"); nt.links.new(ni.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs[0], b.inputs["Normal"])
    if name == "hero_lobby_glass":
        b.inputs["Alpha"].default_value = 0.28
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    if emit: b.inputs["Emission Color"].default_value = hexc(emit[0]); b.inputs["Emission Strength"].default_value = emit[1]
    MATS[name] = m; return m

# the asset collections, in a fixed order, under one root per property
root = bpy.data.collections.new(OID); sc.collection.children.link(root)
CO = {}
for c in COLLS:
    CO[c] = bpy.data.collections.new(c); root.children.link(CO[c])
CO["Amenities"]["note"] = "Empty by design: the workbook lists no amenities for this property. Add only what the landlord confirms."

def build_mesh(name, groups):
    me = bpy.data.meshes.new(name); verts, faces_, uvs, mids = [], [], [], []
    order = sorted(groups.keys())
    for mi, m in enumerate(order):
        g = groups[m]; base = len(verts)
        for (x, y, z) in g["v"]:
            px, py = T(x, y); verts.append((px, py, z))
        for f in g["f"]: faces_.append([base + i for i in f]); mids.append(mi)
        uvs.extend(g["uv"])
    me.from_pydata(verts, [], faces_); me.update()
    uvl = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        for loop_index in poly.loop_indices: uvl.data[loop_index].uv = uvs[me.loops[loop_index].vertex_index]
    for m in order: me.materials.append(mat(m))
    me.polygons.foreach_set("material_index", mids); me.validate()
    return me

EXPORT = []
ntri = 0
for c in COLLS:
    groups = {m: g for (cc_, m), g in G.items() if cc_ == c}
    if not groups: continue
    me = build_mesh(f"{OID}_{c}", groups); ob = bpy.data.objects.new(f"{OID}_{c}", me); CO[c].objects.link(ob); EXPORT.append(ob)
    ntri += sum(len(p.vertices) - 2 for p in me.polygons)
# the name on the canopy fascia (or the sign tower), and any numbered labels
def make_text(body, lx, ly, lz, size, key):
    cu = bpy.data.curves.new(key, "FONT"); cu.body = body; cu.size = size; cu.extrude = 0.03; cu.align_x = "CENTER"
    t_ = bpy.data.objects.new(f"{OID}_{key}", cu); CO["Building_Facades"].objects.link(t_)
    px, py = T(lx, ly); t_.location = (px, py, lz); t_.rotation_euler = (math.pi / 2, 0, math.atan2(U[1], U[0])); t_.data.materials.append(mat("opt_name"))
    bpy.context.view_layer.objects.active = t_; t_.select_set(True); bpy.ops.object.convert(target="MESH"); t_.select_set(False)
    t_ = bpy.data.objects[f"{OID}_{key}"]; EXPORT.append(t_); return sum(len(p_.vertices) - 2 for p_ in t_.data.polygons)
_ns = NAME_SPOT if NAME_SPOT is not None else (0.0, YF - CD - 0.02, CZ + 0.02 if GRADE_A else CZ + 0.03, 0.62 if GRADE_A else 0.5)
if _ns is not False: ntri += make_text(SP["name"], _ns[0], _ns[1], _ns[2], _ns[3], "name")
for i_, (tx_, lx_, ly_, lz_, sz_) in enumerate(LABELS): ntri += make_text(tx_, lx_, ly_, lz_, sz_, f"label{i_}")
print("hero triangles", ntri, "materials", len({m for (_, m) in G}) + 1)

# the material library board: one swatch per material, off to the side, never exported
for i, (n_, m_) in enumerate(sorted(MATS.items())):
    sw = bpy.data.meshes.new("swatch_" + n_); bx_ = 0.9
    sw.from_pydata([(0, 0, 0), (bx_, 0, 0), (bx_, 0, bx_), (0, 0, bx_)], [], [[0, 1, 2, 3]]); sw.materials.append(m_)
    uvl_ = sw.uv_layers.new(name="UVMap")
    for k, uv in enumerate([(0, 0), (1, 0), (1, 1), (0, 1)]): uvl_.data[k].uv = uv
    o_ = bpy.data.objects.new("swatch_" + n_, sw); o_.location = (C[0] + (i % 8) * 1.1 - 4, C[1] - D - 80 - (i // 8) * 1.1, 0); CO["Materials"].objects.link(o_)

# preview trees (leaf-card crowns), for the Blender stills only: the page plants its own tree models from the site file
coll("Vegetation_preview")
def crown_cards(m, x, y, z, r, n, hz=0.75):
    for _ in range(n):
        a = RND.uniform(0, math.tau); rr = r * math.sqrt(RND.random()); zz = z + RND.uniform(-1, 1) * r * hz
        cx_, cy_ = x + math.cos(a) * rr, y + math.sin(a) * rr; s = r * RND.uniform(0.32, 0.45); t = RND.uniform(0, math.pi); tl = RND.uniform(-0.8, 0.8)
        ex, ey = math.cos(t) * s, math.sin(t) * s; fx, fy, fz = -math.sin(t) * math.sin(tl) * s, math.cos(t) * math.sin(tl) * s, math.cos(tl) * s
        poly3(m, [(cx_ + sx * ex + sy * fx, cy_ + sx * ey + sy * fy, zz + sy * fz) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))], [(0, 1), (1, 1), (1, 0), (0, 0)])
for x, y, t, s in trees:
    if t == 2:   # palm: a ringed trunk and a crown of fronds
        cyl("hero_bark", x, y, 0.0, 8.0 * s, 0.18 * s, 8, top=False)
        for k in range(14):
            a = k * math.tau / 14 + RND.uniform(-0.1, 0.1); L_ = 3.4 * s; dr = RND.uniform(0.3, 0.7)
            ex, ey = math.cos(a), math.sin(a); px_, py_ = -ey * 0.55 * s, ex * 0.55 * s; zt = 8.0 * s
            poly3("leaf_palm", [(x - px_, y - py_, zt), (x + px_, y + py_, zt), (x + ex * L_ + px_, y + ey * L_ + py_, zt - dr * L_), (x + ex * L_ - px_, y + ey * L_ - py_, zt - dr * L_)], [(0, 0), (0, 1), (1, 1), (1, 0)])
    elif t == 1:   # ashoka: a narrow column
        cyl("hero_bark", x, y, 0.0, 9.5 * s, 0.14 * s, 8, top=False)
        for k in range(6): crown_cards("leaf_b", x, y, 2.6 * s + k * 1.4 * s, (1.5 - k * 0.2) * s, 26, 0.5)
    else:          # neem: a broad, open dome
        cyl("hero_bark", x, y, 0.0, 4.0 * s, 0.22 * s, 8, top=False)
        crown_cards("leaf", x, y, 6.4 * s, 3.4 * s, 110, 0.45)
pg = {m: g for (cc_, m), g in G.items() if cc_ == "Vegetation_preview"}
if pg:
    pv = bpy.data.objects.new(f"{OID}_preview_trees", build_mesh(f"{OID}_preview_trees", pg)); CO["Vegetation"].objects.link(pv)
    pv["note"] = "Preview only, not exported: the explorer plants its own tree models from the site file."

# lighting and the five cameras
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); CO["Lighting_And_Cameras"].objects.link(sun)
sun.data.energy = 3.6; sun.data.angle = math.radians(0.8); sun.data.color = (1.0, 0.88, 0.74)
az, el = math.radians(245), math.radians(19)       # late afternoon: the warm, long-shadow light of the references
sun.rotation_euler = mathutils.Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))).to_track_quat("Z", "Y").to_euler()
CAMS = {   # local frame: (eye x, y, z), (look-at x, y, z), lens
    "property": ((-W * 0.95, YF - D * 1.15, max(45, H * 2.6)), (0, 0, H * 0.3), 32),
    "closeup": ((-W * 0.22, YF - 16.0, 6.5), (-W * 0.05, YF, H * 0.62), 28),
    "street": None,
    "landscape": ((X1 + 2.0, YF - 12.0, 3.2), (X1 - W * 0.35, YF - 4.0, 1.2), 24),
}
CAMOBJ = {}
CAMS["street"] = ((-14.0, YF - 31.0, 1.7), (0, YF, H * 0.45), 24)   # replaced by the road-aware position below, once the site is known
for tag, (eye, at_, lens) in CAMS.items():
    cam = bpy.data.objects.new("cam_" + tag, bpy.data.cameras.new("cam_" + tag)); CO["Lighting_And_Cameras"].objects.link(cam)
    ex, ey = T(eye[0], eye[1]); ax_, ay_ = T(at_[0], at_[1]); cam.location = (ex, ey, eye[2]); cam.data.lens = lens; cam.data.clip_end = 3000
    cam.rotation_euler = mathutils.Vector((ax_ - ex, ay_ - ey, at_[2] - eye[2])).to_track_quat("-Z", "Y").to_euler(); CAMOBJ[tag] = cam
sc.camera = CAMOBJ["property"]

# export: a merged copy of the exportable collections (one primitive per material), then the copy is removed
bpy.ops.object.select_all(action="DESELECT")
for o in EXPORT: o.select_set(True)
bpy.context.view_layer.objects.active = EXPORT[0]
bpy.ops.object.duplicate(); bpy.ops.object.join(); merged = bpy.context.view_layer.objects.active; merged.name = f"{OID}_hero"
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_apply=True, export_yup=True, export_normals=True,
                          export_materials="EXPORT", export_image_format="NONE", export_texcoords=True)
bpy.data.objects.remove(merged, do_unlink=True)
json.dump({"C": [0.0, 0.0], "phi": 0.0, "note": "built in the scene's own metres"}, open(OUT + ".frame.json", "w"))
# the street camera: straight out from the entrance, across the road to its far edge (the opposite footpath), never
# inside a building; falls back to 31 m out, the classic view across a wide road
road_l = unary_union([Polygon([Tinv(*p) for p in g.exterior.coords]) for g in getattr(roads, "geoms", [roads])]).buffer(0)
blt_l = unary_union([Polygon([Tinv(*p) for p in Polygon(b["p"]).exterior.coords]).buffer(0) for b in S["buildings"] if Polygon(b["p"]).distance(foot) < 120] + [B])
street_xy = None
_cl = Point(-14.0, YF - 31.0)   # the classic view across a wide road, kept wherever it stands on the street
if road_l.buffer(1.8).contains(_cl) and not blt_l.buffer(1.0).contains(_cl): street_xy = (-14.0, YF - 31.0)
for sx in ((-10.0, -6.0, -14.0, 0.0, 6.0) if street_xy is None else ()):
    run_ = [d for d in np.arange(6.0, 60.0, 0.5) if road_l.buffer(1.8).contains(Point(sx, YF - d)) and not blt_l.buffer(1.0).contains(Point(sx, YF - d))]
    if not run_: continue
    first = [run_[0]]
    for d in run_[1:]:
        if d - first[-1] > 0.6: break
        first.append(d)
    if first[-1] - first[0] >= 4.0: street_xy = (sx, YF - first[-1]); break
if street_xy is None: street_xy = (-14.0, YF - 31.0)
print("street camera", [round(v, 1) for v in street_xy], "local")
_c = CAMOBJ["street"]; _ex, _ey = T(*street_xy); _ax, _ay = T(0, YF); _c.location = (_ex, _ey, 1.7)
_c.rotation_euler = mathutils.Vector((_ax - _ex, _ay - _ey, H * 0.45 - 1.7)).to_track_quat("-Z", "Y").to_euler()
site = {"plot": [[round(x, 2), round(y, 2)] for x, y in (T(*p) for p in plot.exterior.coords)],
        "trees": [[round(T(x, y)[0], 2), round(T(x, y)[1], 2), t, round(s, 2)] for x, y, t, s in trees],
        "front": [[round(v, 2) for v in T(X0, YF)], [round(v, 2) for v in T(X1, YF)]], "entrance": [round(v, 2) for v in T(ENTR[0]["x"], YF - ENTR[0]["d"] - 2)], "gates": [[round(v, 2) for v in T(g["x"], g["y"])] for g in GATES],
        "street_cam": [round(v, 2) for v in T(*street_xy)]}
if UPPER: site["upper"] = {"from": UPPER["from"], "foot": [[round(a, 2), round(b, 2)] for a, b in UPPER_FOOT]}
json.dump(site, open(OUT + ".site.json", "w"))
print("wrote", OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB")

# ------------------------------------------------------------------ review stills (Cycles), then the editable .blend
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes["Background"]
hp = next((p_ for p_ in (os.path.join(TEX, "..", "sky.hdr"), os.path.join(os.path.dirname(os.path.abspath(OUT)), "..", "sky.hdr")) if os.path.exists(p_)), None)
if hp is None:   # no baked sky beside the textures: Blender's physical sky, with the sun of the stills
    sky = w.node_tree.nodes.new("ShaderNodeTexSky")
    try: sky.sun_elevation, sky.sun_rotation = math.radians(19), math.radians(245)
    except Exception: pass
    w.node_tree.links.new(sky.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 0.35
if hp:
    env = w.node_tree.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(os.path.abspath(hp)); w.node_tree.links.new(env.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 0.8
gp = bpy.data.meshes.new("ground"); R0 = 500
cx_, cy_ = C
gp.from_pydata([(cx_ - R0, cy_ - R0, -0.01), (cx_ + R0, cy_ - R0, -0.01), (cx_ + R0, cy_ + R0, -0.01), (cx_ - R0, cy_ + R0, -0.01)], [], [[0, 1, 2, 3]])
ul = gp.uv_layers.new(name="UVMap")
for k, uv in enumerate([(0, 0), (R0 / 3, 0), (R0 / 3, R0 / 3), (0, R0 / 3)]): ul.data[k].uv = uv
go = bpy.data.objects.new("ground", gp); CO["Landscaping"].objects.link(go); gp.materials.append(mat("ground_noida"))
go["note"] = "Preview ground, not exported: the explorer has the district around the plot."
sc.render.engine = "CYCLES"; sc.cycles.samples = 24 if FAST else 96; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = (1280, 800) if not FAST else (960, 600)
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
if RENDER:
    for tag in ("property", "closeup", "street", "landscape"):
        sc.camera = CAMOBJ[tag]; sc.render.filepath = f"{RENDER}-{tag}.png"; bpy.ops.render.render(write_still=True); print("render", sc.render.filepath)
    sc.camera = CAMOBJ["property"]
if BLEND:
    os.makedirs(os.path.dirname(os.path.abspath(BLEND)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND), compress=True)
    try: bpy.ops.file.make_paths_relative(); bpy.ops.wm.save_mainfile(compress=True)
    except Exception as e: print("relative paths:", e)
    print("wrote", BLEND, round(os.path.getsize(BLEND) / 1e6, 2), "MB")
