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
GH, FH, NF = S.get("ground_h", 5.0), S.get("floor_h", 4.0), int(SP["floors"])
H = GH + NF * FH            # top of the roof slab
PAR = 1.4 if SP["grade"] == "A" else 1.2
GRADE_A = SP["facade"] == "curtain"
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
faces.sort(key=lambda f: f[0]); _, fi, FA, FB = faces[0]
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
        "hero_hedge": (1.5, 1.5), "hero_plaster": (2.4, 2.4), "hero_plaster_b": (2.4, 2.4)}
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
def wall(m, x0, y0, x1, y1, z0, z1, u0=0.0, v_top=None):
    """A vertical quad from (x0,y0) to (x1,y1), facing right of the direction of travel; UVs in metres / tile."""
    tw, th = TILE.get(m, (1.0, 1.0)); L = math.hypot(x1 - x0, y1 - y0); vt = z1 if v_top is None else v_top
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
if not GRADE_A:
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

# ------------------------------------------------------------------ the plot
if GRADE_A: STILT, Z0 = False, 0.45
plot_scene = foot.buffer(10.5, join_style="mitre").difference(roads.buffer(1.5)).buffer(-0.01)
plot_scene = max(getattr(plot_scene, "geoms", [plot_scene]), key=lambda g: g.area)
others = [Polygon(b["p"]).buffer(0) for b in S["buildings"] if not b.get("opt") and Polygon(b["p"]).distance(foot) < 30 and not Polygon(b["p"]).intersects(foot)]
if others: plot_scene = plot_scene.difference(unary_union(others).buffer(1.5)); plot_scene = max(getattr(plot_scene, "geoms", [plot_scene]), key=lambda g: g.area)
plot = Polygon([Tinv(*p) for p in plot_scene.exterior.coords]).simplify(0.3)
B = Polygon([(X0, YF), (X1, YF), (X1, YB), (X0, YB)])
walk_z, drive_z = 0.16, 0.04
inner_plot = plot.buffer(-2.6, join_style="mitre")
walkway = B.buffer(3.2, join_style="mitre").difference(B.buffer(0.6, join_style="mitre"))
beds = B.buffer(1.8, join_style="mitre").difference(B.buffer(0.6, join_style="mitre")).difference(box(-PORTAL / 2 - 4, YF - 8, PORTAL / 2 + 4, YF + 1))
if STILT: beds = beds.intersection(box(X0 - 3, YB - 0.1, X1 + 3, YB + 3))   # a stilt is driven into from the front and sides: beds at the back only
forecourt = box(-CW / 2 - 1, YF - CD - 1.5, CW / 2 + 1, YF - 0.6)
drive = inner_plot.difference(B.buffer(3.2, join_style="mitre")).difference(forecourt)
strip = plot.difference(inner_plot)
gate_x = tuple(s * max(CW / 2 + 1 + 3.5 + 1.0, W / 2 - 9.0) for s in (-1, 1)); GATE_W = 7.0
bound = plot.exterior
front_strip = strip.intersection(box(X0 - 40, YF - 40, X1 + 40, YF - 3.5))
# layered planting along the road boundary (grasses at the back, shrubs, flowers at the front), in a bed whose
# inner edge curves; the rest of the road-side strip is lawn
fb_line = [bound.interpolate(d) for d in np.arange(0.0, bound.length, 1.0)]
fb_pts = [p for p in fb_line if p.y < YF - 3.5 and not any(abs(p.x - gx) < GATE_W / 2 + 1.5 for gx in gate_x)]
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
def in_gate(p): return p.y < YF - 3 and any(abs(p.x - gx) < GATE_W / 2 for gx in gate_x)
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
    ribbon("parapet", ls, 0.0, 0.95)
    c = list(ls.coords)
    for (ax_, ay_), (bx2, by2) in zip(c, c[1:]):
        L_ = math.hypot(bx2 - ax_, by2 - ay_); ang_ = math.atan2(by2 - ay_, bx2 - ax_)
        bx("hero_concrete", (ax_ + bx2) / 2, (ay_ + by2) / 2, 0.95, 1.02, L_ + 0.02, 0.3, ang_)   # coping
        bx("hero_rail", (ax_ + bx2) / 2, (ay_ + by2) / 2, 1.95, 2.0, L_, 0.05, ang_, bottom=True)
    for d in np.arange(0.0, ls.length, 0.16):
        p = ls.interpolate(d); bx("hero_rail", p.x, p.y, 1.02, 1.95, 0.022, 0.022, top=False)
    for d in np.arange(0.0, ls.length + 0.01, 3.2):
        p = ls.interpolate(min(d, ls.length)); bx("hero_stone", p.x, p.y, 0.0, 2.15, 0.45, 0.45); bx("hero_concrete", p.x, p.y, 2.15, 2.25, 0.55, 0.55)
# gates (sliding mild-steel panels, half open), guard cabin, boom barrier
for gx in gate_x:
    gy = bound.interpolate(bound.project(Point(gx, YF - 20))).y
    bx("hero_rail", gx - GATE_W / 2 - 1.2, gy + 0.4, 0.1, 1.9, 3.6, 0.06)
    for k in range(18): bx("hero_rail", gx - GATE_W / 2 - 2.9 + k * 0.2, gy + 0.4, 0.15, 1.85, 0.03, 0.03, top=False)
    for sx in (-GATE_W / 2, GATE_W / 2): bx("hero_stone", gx + sx, gy, 0.0, 2.6, 0.6, 0.6); bx("hero_concrete", gx + sx, gy, 2.6, 2.72, 0.7, 0.7)
cbx = gate_x[0] + GATE_W / 2 + 3.2
if cbx + 1.3 + 2.0 > -CW / 2 - 1: cbx = gate_x[0] - GATE_W / 2 - 3.2     # no room between the gate and the forecourt: the outer side
cby = YF - 7.2
bx("hero_concrete", cbx, cby, 0.0, 2.9, 2.6, 2.4); bx("hero_lobby_glass", cbx, cby - 1.21, 1.0, 2.3, 2.0, 0.02, top=False); bx("hero_alu", cbx, cby, 2.9, 3.1, 3.4, 3.2, bottom=True)
bx("boom", gate_x[0] + GATE_W / 2 - 0.4, YF - 5.0, 0.0, 1.0, 0.35, 0.35); bx("ad_white", gate_x[0], YF - 5.0, 0.95, 1.05, GATE_W - 1.0, 0.08, bottom=True)
# lights: poles along the drive, bollards along the walkway
for d in np.arange(4.0, inner_plot.exterior.length, 16.0):
    p = inner_plot.exterior.interpolate(d)
    if p.y < YF - 2 and any(abs(p.x - gx) < GATE_W for gx in gate_x): continue
    cyl("hero_rail", p.x, p.y, 0.0, 6.0, 0.07, 8, top=False); bx("hero_rail", p.x, p.y, 6.0, 6.15, 0.9, 0.25); hquad("lobby_light", p.x - 0.4, p.y - 0.1, p.x + 0.4, p.y + 0.1, 5.99, up=False)
wo = B.buffer(3.2, join_style="mitre").exterior
for d in np.arange(2.0, wo.length, 6.0):
    p = wo.interpolate(d)
    if p.y < YF - 0.5 and abs(p.x) < CW / 2 + 1.5: continue
    if STILT and p.y < YB: continue
    cyl("hero_rail", p.x, p.y, walk_z, walk_z + 0.9, 0.09, 10); cyl("lobby_light", p.x, p.y, walk_z + 0.78, walk_z + 0.86, 0.095, 10, top=False)

# ------------------------------------------------------------------ planting: hedges, shrubs, layered beds, bougainvillea (trees go to the site file)
coll("Vegetation")
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
    if abs(p.y - YF) < 4 and abs(p.x) < CW / 2 + 12: shrub("leaf_flower", p.x, p.y, walk_z, RND.uniform(0.4, 0.55), 10, tall=0.7)
    elif i % 5 == 0: clump("leaf_grass", p.x, p.y, walk_z, 1.1, 1.0)
    else: shrub("leaf_shrub", p.x, p.y, walk_z, RND.uniform(0.6, 0.9))
# raised planters flanking the entrance, with flowers
for sx in (-1, 1):
    px_ = sx * (CW / 2 + 0.2); py_ = YF - CD - 0.4
    coll("Landscaping"); bx("hero_stone", px_, py_, walk_z, walk_z + 0.55, 1.6, 1.6, mats=("hero_stone", "hero_mulch"))
    coll("Vegetation"); shrub("leaf_flower", px_, py_, walk_z + 0.55, 0.6, 14, tall=0.7)
# bougainvillea at the gate pillars
for gx in gate_x:
    gy = bound.interpolate(bound.project(Point(gx, YF - 20))).y
    for sx in (-GATE_W / 2 - 1.4, GATE_W / 2 + 1.4): shrub("leaf_bloom", gx + sx, gy + 0.9, 0.06, 1.3, 22)
# trees for the site file: ashoka along the road boundary, neem along the others, palms at the forecourt
trees = []
inner_ring = plot.buffer(-1.6, join_style="mitre").exterior
for d in np.arange(2.0, inner_ring.length, 1.0):
    p = inner_ring.interpolate(d)
    if any(abs(p.x - gx) < GATE_W / 2 + 2.5 for gx in gate_x) and p.y < YF - 2: continue
    front_side = p.y < YF - 3
    step = 4.5 if front_side else 9.0
    if trees and min(math.hypot(p.x - t[0], p.y - t[1]) for t in trees) < step: continue
    if rx is not None and abs(p.x - rx) < 4 and abs(p.y - ry) < 7: continue
    if front_side and abs(p.x) < CW / 2 + 5: continue      # keep the view to the entrance open
    if abs(p.x - cbx) < 3 and abs(p.y - cby) < 3: continue
    trees.append((p.x, p.y, 1 if front_side else 0, RND.uniform(0.85, 1.15) if front_side else RND.uniform(0.8, 1.1)))
for sx in (-CW / 2 - 2.5, CW / 2 + 2.5):
    for k in range(2): trees.append((sx, YF - 1.5 - k * 4.5, 2, RND.uniform(0.9, 1.05)))
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
# the name on the canopy fascia
cu = bpy.data.curves.new("name", "FONT"); cu.body = SP["name"]; cu.size = 0.62 if GRADE_A else 0.5; cu.extrude = 0.03; cu.align_x = "CENTER"
tob = bpy.data.objects.new(f"{OID}_name", cu); CO["Building_Facades"].objects.link(tob)
_cz = CZ if not GRADE_A else CZ
px, py = T(0, YF - CD - 0.02); tob.location = (px, py, _cz + 0.02 if GRADE_A else _cz + 0.03)
tob.rotation_euler = (math.pi / 2, 0, math.atan2(U[1], U[0])); tob.data.materials.append(mat("opt_name"))
bpy.context.view_layer.objects.active = tob; tob.select_set(True); bpy.ops.object.convert(target="MESH"); tob.select_set(False)
tob = bpy.data.objects[f"{OID}_name"]; EXPORT.append(tob); ntri += sum(len(p.vertices) - 2 for p in tob.data.polygons)
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
        "front": [[round(v, 2) for v in T(X0, YF)], [round(v, 2) for v in T(X1, YF)]], "entrance": [round(v, 2) for v in T(0, YF - CD - 2)],
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
