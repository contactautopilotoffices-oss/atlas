"""Magnus Towers (JindalX option 1, Sector 67, Noida): the building and its plot, modelled for the explorer.

  python scripts/world/magnus_hero.py SCENE.json TEX_DIR OUT.glb [--render OUT_PREFIX] [--fast]

Writes OUT.glb (built in the scene's own metres, so OUT.glb.frame.json is C = [0, 0], phi = 0 for
diorama.py --exterior), and OUT.glb.site.json: the plot outline and typed tree positions (diorama.py
--site drops the district's random trees inside the plot and plants these with the page's tree models).
--render writes Cycles stills of the model alone (aerial, entrance, street), for review.

WHAT IS KNOWN (and drives the model):
  - B+G+5, 38,000 sq ft (3,530 m2) a floor: the client's workbook (jindalx/source-options.json)
  - a glass, glazing and windows contract for C-2, Sector 67, Sept 2025 (Faalcon Concepts' BSE filing):
    the building is glazed
  - ground storey 5.0 m, typical storey 4.0 m: scripts/world/regions/noida-jindalx-67.json (the explorer's
    floor bands use the same heights, so the lit "on offer" floor lines up)
  - the footprint and position: the indicative plot massing in scripts/world/refs/noida_jindalx.json,
    52.1 m frontage on the east road x 67.7 m deep, 12 m from the road (NOT surveyed)

ASSUMED (a neutral, plausible design for a new Grade A office in a Noida industrial sector; the real
design by Sanjiv Tandon Architects has not been seen; replace when the developer's drawings arrive):
  - architecture: stone-clad columns and a recessed glazed ground floor; a double-height entrance under a
    7 m cantilevered canopy on the road face; unitised curtain wall (1.5 m mullions, spandrel bands)
    on floors 1-5; projecting slab-edge bands in champagne aluminium; a deep aluminium frame with fins
    round the middle of the road face; stone-clad stair and lift cores at the four corners
  - roof: parapet with coping, lift machine room, three air-cooled chillers, two cooling towers, four
    plastic overhead water tanks, a rooftop solar array (common on new Noida offices)
  - site: boundary wall with railing, entry and exit gates on the road face, guard cabin and boom barrier,
    a paved walkway round the building, a one-way drive with marked parallel parking, a covered basement
    ramp (the workbook's "B" and 1:1000 parking imply a basement), lawns, hedges, shrubs, bougainvillea
    at the gates, ashoka along the road boundary, neem along the others, palms at the forecourt, pole
    and bollard lights
  - NOT modelled: pool, clubhouse, courts, cafeteria (the workbook does not support them)
"""
import sys, os, json, math, random
import numpy as np
import shapely
from shapely.geometry import Polygon, Point, LineString, box
from shapely.ops import unary_union

A = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
SCENE, TEX, OUT = A[0], A[1], A[2]
RENDER = A[A.index("--render") + 1] if "--render" in A else None
FAST = "--fast" in A
OID = "magnus-towers"
RND = random.Random(67)

S = json.load(open(SCENE))
REFS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "refs", "noida_jindalx.json")))
foot = Polygon(REFS[OID]["poly"]).buffer(0)
GH, FH, NF = S.get("ground_h", 5.0), S.get("floor_h", 4.0), 5
H = GH + NF * FH            # top of the roof slab: 25.0 m
PAR = 1.4                   # parapet

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
print(f"Magnus: front {W:.1f} m, depth {D:.1f} m, front face {fi}, road {faces[0][0]:.1f} m away")

# ------------------------------------------------------------------ geometry accumulator (local frame)
TILE = {"hero_glass": (6.0, 8.0), "hero_alu": (2.4, 2.4), "hero_stone": (2.4, 2.4), "hero_concrete": (4.8, 4.8), "hero_roof": (4.0, 4.0),
        "hero_pavers": (2.0, 2.0), "hero_asphalt": (4.0, 4.0), "hero_lawn": (4.0, 4.0), "hero_mulch": (2.0, 2.0), "hero_spandrel": (3.0, 3.0),
        "hero_hedge": (1.5, 1.5)}
G = {}
def grp(m): return G.setdefault(m, {"v": [], "f": [], "uv": []})
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

# plinth: the ground floor sits 0.45 m above the forecourt
plinth = Polygon([(X0 - 0.6, YF - 0.6), (X1 + 0.6, YF - 0.6), (X1 + 0.6, YB + 0.6), (X0 - 0.6, YB + 0.6)])
flat("hero_stone", plinth, 0.45); ribbon("hero_stone", LineString(list(plinth.exterior.coords)), 0.0, 0.45, both=False)

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

# ------------------------------------------------------------------ the plot
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
forecourt = box(-CW / 2 - 1, YF - CD - 1.5, CW / 2 + 1, YF - 0.6)
drive = inner_plot.difference(B.buffer(3.2, join_style="mitre")).difference(forecourt)
strip = plot.difference(inner_plot)
flat("hero_pavers", walkway.difference(beds).union(forecourt.intersection(plot)), walk_z)
flat("hero_mulch", beds, walk_z - 0.02)
flat("hero_asphalt", drive, drive_z)
front_strip = strip.intersection(box(X0 - 40, YF - 40, X1 + 40, YF - 3.5))
flat("hero_lawn", front_strip, 0.06); flat("hero_mulch", strip.difference(front_strip), 0.06)
# kerbs: the raised walkway's edge
for g in getattr(walkway.union(forecourt).buffer(0), "geoms", [walkway.union(forecourt).buffer(0)]):
    ribbon("kerb", LineString(list(g.exterior.coords)), drive_z, walk_z, both=False)
# parking: parallel bays (2.5 x 6 m) marked along the outer edge of the side and back drives
def marks_along(line, step, lane_w):
    L_ = line.length; out = []
    for d in np.arange(3.0, L_ - 3.0, step):
        p = line.interpolate(d); q = line.interpolate(min(L_, d + 0.5)); dx, dy = q.x - p.x, q.y - p.y; n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n; out.append(((p.x, p.y), (p.x + nx * lane_w, p.y + ny * lane_w)))
    return out
edge = inner_plot.exterior
for (a_, b_) in marks_along(edge, 6.0, 2.5):
    mid = Point((a_[0] + b_[0]) / 2, (a_[1] + b_[1]) / 2)
    if not drive.buffer(-0.2).contains(mid) or mid.y < YF - 2: continue
    dx, dy = b_[0] - a_[0], b_[1] - a_[1]; L_ = math.hypot(dx, dy); tx, ty = -dy / L_ * 0.06, dx / L_ * 0.06
    poly3("marking", [(a_[0] - tx, a_[1] - ty, drive_z + 0.01), (a_[0] + tx, a_[1] + ty, drive_z + 0.01), (b_[0] + tx, b_[1] + ty, drive_z + 0.01), (b_[0] - tx, b_[1] - ty, drive_z + 0.01)], [(0, 0)] * 4)
# the drive's centre line arrows are left out; a covered basement ramp on the back drive, near the west corner
rx, ry = X0 + 9.0, YB + 6.0
for sx in (-2.1, 2.1): bx("hero_concrete", rx + sx, ry, 0.0, 1.1, 0.25, 9.0)
bx("hero_concrete", rx, ry - 3.0, 2.8, 3.2, 4.8, 3.2, bottom=True)
for sx in (-2.1, 2.1): bx("hero_concrete", rx + sx, ry - 3.0, 0.0, 2.8, 0.3, 0.3)
hquad("hero_dark", rx - 1.95, ry - 4.4, rx + 1.95, ry + 4.4, drive_z + 0.02)

# boundary wall with railing and pillars, gates on the road face
gate_x = (-W / 2 + 9.0, W / 2 - 9.0); GATE_W = 7.0
bound = plot.exterior
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
    ribbon("parapet", ls, 0.0, 0.95);
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
cbx, cby = gate_x[0] + GATE_W / 2 + 3.2, YF - 7.2
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
    cyl("hero_rail", p.x, p.y, walk_z, walk_z + 0.9, 0.09, 10); cyl("lobby_light", p.x, p.y, walk_z + 0.78, walk_z + 0.86, 0.095, 10, top=False)

# ------------------------------------------------------------------ planting: hedges, shrubs, bougainvillea (trees go to the site file)
def hedge_along(line, w, h, z0=0.06):
    c = list(line.coords)
    for (ax_, ay_), (bx2, by2) in zip(c, c[1:]):
        L_ = math.hypot(bx2 - ax_, by2 - ay_)
        if L_ < 0.5: continue
        bx("hero_hedge", (ax_ + bx2) / 2, (ay_ + by2) / 2, z0, z0 + h, L_, w, math.atan2(by2 - ay_, bx2 - ax_))
def shrub(m, x, y, z, r, cards=14):
    for _ in range(cards):
        a = RND.uniform(0, math.pi); u_, v_ = RND.uniform(-1, 1), RND.uniform(-0.2, 1)
        cx_, cy_, cz_ = x + math.cos(a) * u_ * r * 0.5, y + math.sin(a) * u_ * r * 0.5, z + r * 0.45 + v_ * r * 0.45
        s = r * RND.uniform(0.55, 0.8); t = RND.uniform(-0.6, 0.6)
        ex, ey = math.cos(a) * s, math.sin(a) * s; fx, fy, fz = -math.sin(a) * math.sin(t) * s, math.cos(a) * math.sin(t) * s, math.cos(t) * s
        P = [(cx_ + sx * ex + sy * fx, cy_ + sx * ey + sy * fy, cz_ + sy * fz) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        poly3(m, P, [(0, 1), (1, 1), (1, 0), (0, 0)])
# a hedge inside the boundary wall, except at the gates
for sg in segs:
    ls = LineString(sg)
    if ls.length < 2: continue
    off = ls.parallel_offset(1.0, "left" if plot.exterior.is_ccw else "right")
    for g in getattr(off, "geoms", [off]):
        if g.length > 1.5 and plot.buffer(-0.4).contains(g.centroid): hedge_along(g.simplify(0.3), 0.8, 1.1)
# shrubs in the beds round the building
bl = B.buffer(1.2, join_style="mitre").exterior
for d in np.arange(1.0, bl.length, 2.2):
    p = bl.interpolate(d)
    if beds.contains(p): shrub("leaf_shrub", p.x, p.y, walk_z, RND.uniform(0.6, 0.9))
# bougainvillea at the gate pillars and the cabin
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
    if abs(p.x - rx) < 4 and abs(p.y - ry) < 7: continue
    if front_side and abs(p.x) < CW / 2 + 5: continue      # keep the view to the entrance open
    trees.append((p.x, p.y, 1 if front_side else 0, RND.uniform(0.85, 1.15) if front_side else RND.uniform(0.8, 1.1)))
for sx in (-CW / 2 - 2.5, CW / 2 + 2.5):
    for k in range(2): trees.append((sx, YF - 1.5 - k * 4.5, 2, RND.uniform(0.9, 1.05)))
print("site trees", len(trees), "plot", round(plot.area), "m2")

# ------------------------------------------------------------------ Blender: meshes in scene metres, materials, export
import bpy, bmesh
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def hexc(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)
MATDEF = {   # name: (colour, roughness, metallic, texture, emission)   textures for the Cycles stills; the page loads its own by name
    "hero_glass": ("#2e3c46", 0.06, 0.35, "hero_glass", None), "hero_spandrel": ("#32373c", 0.15, 0.4, "hero_spandrel", None),
    "hero_alu": ("#bdb19a", 0.32, 0.65, "hero_alu", None), "hero_stone": ("#c4b08e", 0.62, 0.0, "hero_stone", None),
    "hero_concrete": ("#b4b2ac", 0.8, 0.0, "hero_concrete", None), "hero_roof": ("#a8aaa8", 0.75, 0.0, "hero_roof", None),
    "hero_pavers": ("#9a9894", 0.85, 0.0, "hero_pavers", None), "hero_asphalt": ("#46464a", 0.9, 0.0, "hero_asphalt", None),
    "hero_lawn": ("#5f8a3a", 0.92, 0.0, "hero_lawn", None), "hero_mulch": ("#5e4430", 0.95, 0.0, "hero_mulch", None),
    "hero_hedge": ("#3f6a2c", 0.9, 0.0, "leaves_shrub", None), "hero_mullion": ("#2e3236", 0.35, 0.8, None, None),
    "hero_hvac": ("#b8bcbe", 0.45, 0.6, None, None), "hero_solar": ("#1c2a44", 0.12, 0.3, None, None), "hero_dark": ("#121416", 0.9, 0.0, None, None),
    "hero_rail": ("#2a2c2e", 0.4, 0.8, None, None), "hero_lobby_glass": ("#9cb4bc", 0.03, 0.1, None, None),
    "lobby_ceiling": ("#efede8", 0.8, 0.0, None, None), "lobby_light": ("#fff4e0", 0.5, 0.0, None, ("#fff1d6", 6.0)),
    "kerb": ("#bdb8ab", 0.85, 0.0, None, None), "marking": ("#eeeee6", 0.6, 0.0, None, None), "parapet": ("#d9d3c4", 0.85, 0.0, None, None),
    "tank": ("#1d1f22", 0.5, 0.0, None, None), "boom": ("#d23b2c", 0.4, 0.0, None, None), "ad_white": ("#efefea", 0.5, 0.0, None, None),
    "leaf_shrub": ("#4a7a34", 0.8, 0.0, "leaves_shrub", None), "leaf_bloom": ("#4a7a34", 0.8, 0.0, "leaves_bloom", None), "opt_name": ("#ffffff", 0.4, 0.0, None, ("#fff2da", 1.0)),
}
MATS = {}
def mat(name):
    if name in MATS: return MATS[name]
    col, rough, metal, texn, emit = MATDEF.get(name, ("#9a9a9a", 0.8, 0.0, None, None))
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hexc(col); b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if texn:
        ext = ".png" if texn.startswith("leaves") else ".jpg"; p = os.path.join(TEX, texn + ext)
        if os.path.exists(p):
            im = nt.nodes.new("ShaderNodeTexImage"); im.image = bpy.data.images.load(p, check_existing=True); nt.links.new(im.outputs["Color"], b.inputs["Base Color"])
            if texn.startswith("leaves") and name.startswith("leaf"):
                nt.links.new(im.outputs["Alpha"], b.inputs["Alpha"])
                try: m.surface_render_method = "DITHERED"
                except Exception: pass
            rp = os.path.join(TEX, texn + "_r.jpg")
            if os.path.exists(rp):
                ri = nt.nodes.new("ShaderNodeTexImage"); ri.image = bpy.data.images.load(rp, check_existing=True); ri.image.colorspace_settings.name = "Non-Color"
                sep = nt.nodes.new("ShaderNodeSeparateColor"); nt.links.new(ri.outputs["Color"], sep.inputs[0]); nt.links.new(sep.outputs[1], b.inputs["Roughness"])
            np_ = os.path.join(TEX, texn + "_n.jpg")
            if os.path.exists(np_):
                ni = nt.nodes.new("ShaderNodeTexImage"); ni.image = bpy.data.images.load(np_, check_existing=True); ni.image.colorspace_settings.name = "Non-Color"
                nm = nt.nodes.new("ShaderNodeNormalMap"); nt.links.new(ni.outputs["Color"], nm.inputs["Color"]); nt.links.new(nm.outputs[0], b.inputs["Normal"])
    if name == "hero_lobby_glass":
        b.inputs["Alpha"].default_value = 0.28
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    if emit: b.inputs["Emission Color"].default_value = hexc(emit[0]); b.inputs["Emission Strength"].default_value = emit[1]
    MATS[name] = m; return m

me = bpy.data.meshes.new("hero"); verts, faces, uvs, mids = [], [], [], []
order = sorted(G.keys())
for mi, m in enumerate(order):
    g = G[m]; base = len(verts)
    for (x, y, z) in g["v"]:
        px, py = T(x, y); verts.append((px, py, z))
    for f in g["f"]: faces.append([base + i for i in f]); mids.append(mi)
    uvs.extend(g["uv"])
me.from_pydata(verts, [], faces); me.update()
uvl = me.uv_layers.new(name="UVMap")
# per-loop UVs: loops follow face vertex order, and every face owns its vertices here
li = 0
for poly in me.polygons:
    for loop_index in poly.loop_indices:
        vi = me.loops[loop_index].vertex_index; uvl.data[loop_index].uv = uvs[vi]
for m in order: me.materials.append(mat(m))
me.polygons.foreach_set("material_index", mids); me.validate()
hero = bpy.data.objects.new("magnus_hero", me); sc.collection.objects.link(hero)
# the name on the canopy fascia
cu = bpy.data.curves.new("name", "FONT"); cu.body = "MAGNUS TOWERS"; cu.size = 0.62; cu.extrude = 0.03; cu.align_x = "CENTER"
tob = bpy.data.objects.new("magnus_name", cu); sc.collection.objects.link(tob)
px, py = T(0, YF - CD - 0.02); tob.location = (px, py, CZ + 0.02)
tob.rotation_euler = (math.pi / 2, 0, math.atan2(U[1], U[0])); tob.data.materials.append(mat("opt_name"))
bpy.context.view_layer.objects.active = tob; tob.select_set(True); bpy.ops.object.convert(target="MESH"); tob.select_set(False)
ntri = sum(len(p.vertices) - 2 for p in me.polygons) + sum(len(p.vertices) - 2 for p in tob.data.polygons)
print("hero triangles", ntri, "materials", len(order))

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True, export_normals=True,
                          export_materials="EXPORT", export_image_format="NONE", export_texcoords=True)
json.dump({"C": [0.0, 0.0], "phi": 0.0, "note": "built in the scene's own metres"}, open(OUT + ".frame.json", "w"))
json.dump({"plot": [[round(x, 2), round(y, 2)] for x, y in (T(*p) for p in plot.exterior.coords)],
           "trees": [[round(T(x, y)[0], 2), round(T(x, y)[1], 2), t, round(s, 2)] for x, y, t, s in trees],
           "front": [[round(v, 2) for v in T(X0, YF)], [round(v, 2) for v in T(X1, YF)]], "entrance": [round(v, 2) for v in T(0, YF - CD - 2)],
           "street_cam": [round(v, 2) for v in T(-14.0, YF - 31.0)]}, open(OUT + ".site.json", "w"))   # street_cam: the far footpath across the road, the classic street view
print("wrote", OUT, round(os.path.getsize(OUT) / 1e6, 2), "MB")

# ------------------------------------------------------------------ review stills of the model alone (Cycles)
if RENDER:
    for m in MATS.values():
        if m.name == "hero_lobby_glass": continue
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; bg = w.node_tree.nodes["Background"]
    hp = os.path.join(TEX, "..", "sky.hdr")
    if os.path.exists(hp):
        env = w.node_tree.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(hp); w.node_tree.links.new(env.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = 0.9
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun)
    sun.data.energy = 3.2; sun.data.angle = math.radians(0.8); sun.data.color = (1.0, 0.92, 0.82)
    az, el = math.radians(235), math.radians(24)   # the explorer's sun: azimuth 235, elevation 24
    d = (math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))
    sun.rotation_euler = (0, 0, 0); import mathutils
    sun.rotation_euler = mathutils.Vector(d).to_track_quat("Z", "Y").to_euler()
    gp = bpy.data.meshes.new("gnd"); gp.from_pydata([(px - 400, py - 400, -0.01), (px + 400, py - 400, -0.01), (px + 400, py + 400, -0.01), (px - 400, py + 400, -0.01)], [], [[0, 1, 2, 3]])
    go = bpy.data.objects.new("gnd", gp); sc.collection.objects.link(go); gm = bpy.data.materials.new("g"); gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hexc("#a89a80"); gp.materials.append(gm)
    # stand-in trees (cones and spheres) so the stills show the planting plan
    for x, y, t, s in trees:
        tx, ty = T(x, y)
        bpy.ops.mesh.primitive_cylinder_add(radius=0.2 * s, depth=3.5 * s, location=(tx, ty, 1.75 * s))
        if t == 1: bpy.ops.mesh.primitive_cone_add(radius1=1.6 * s, depth=9 * s, location=(tx, ty, 6.5 * s))
        elif t == 2: bpy.ops.mesh.primitive_uv_sphere_add(radius=2.6 * s, location=(tx, ty, 9 * s), scale=(1, 1, 0.45))
        else: bpy.ops.mesh.primitive_uv_sphere_add(radius=3.4 * s, location=(tx, ty, 6.5 * s), scale=(1, 1, 0.75))
        o = bpy.context.active_object; o.data.materials.append(mat("hero_hedge"))
    sc.render.engine = "CYCLES"; sc.cycles.samples = 24 if FAST else 96; sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = (1280, 800) if not FAST else (960, 600)
    sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast"
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); sc.collection.objects.link(cam); sc.camera = cam
    def shoot(tag, eye_local, at_local, lens):
        ex, ey = T(eye_local[0], eye_local[1]); axx, ayy = T(at_local[0], at_local[1])
        cam.location = (ex, ey, eye_local[2]); cam.data.lens = lens
        dirv = mathutils.Vector((axx - ex, ayy - ey, at_local[2] - eye_local[2])); cam.rotation_euler = dirv.to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = f"{RENDER}-{tag}.png"; bpy.ops.render.render(write_still=True); print("render", sc.render.filepath)
    shoot("aerial", (-W * 0.9, YF - D * 1.1, 70), (0, 0, 8), 35)
    shoot("entrance", (-14, YF - 22, 1.7), (0, YF, 9), 24)
    shoot("street", (W * 0.75, YF - 16, 1.7), (W * 0.1, YF + 6, 12), 24)
