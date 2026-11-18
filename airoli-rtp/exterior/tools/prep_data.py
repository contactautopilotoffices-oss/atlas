"""Prepare every input the Blender build needs, as plain JSON / NPY (no shapely inside Blender).

usage: venv/bin/python -I prep_data.py <scratch rtp dir> <out dir>
Reads (all untrusted data, parsed only):
  <scratch>/f4/flat.json, f4/clusters.json        CAD 4th-floor shell (cluster 10)
  airoli-rtp/review/frames.json                     CAD metres -> rtp_local
  <scratch>/ctx/context_overture.json, ctx/osm.json Overture footprints/roads, raw OSM ways
  <scratch>/ctx/.dsm_N19_00_E073_00.tif + exterior/_build/dl/dsm_N19_E072.tif   Copernicus GLO-30
Writes <out>/prep.json, <out>/terrain.npz, <out>/assumptions.json, <out>/prep_plan.png
Frame: rtp_local (x east, y north, metres from the Maps pin; z up from site ground).
"""
import json, math, os, sys, random
import numpy as np
import shapely
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point, box as sbox, GeometryCollection
from shapely.ops import unary_union, linemerge, nearest_points
from shapely import affinity

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import cadlib

S, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
ROOT = "/Users/lohit/Downloads/Atlas/airoli-rtp"
LAT0, LON0 = 19.1692159, 73.0017703
KX = 111320.0 * math.cos(math.radians(LAT0)); KY = 110574.0
def ll2xy(lat, lon): return ((lon - LON0) * KX, (lat - LAT0) * KY)
RNG = random.Random(19112026); NPR = np.random.default_rng(19112026)
ASSUME = []
def assume(topic, text): ASSUME.append({"topic": topic, "assumption": text}); print("ASSUME", topic, ":", text)

# ------------------------------------------------------------------ geometry helpers
def polys_of(g):
    if g is None or g.is_empty: return []
    if isinstance(g, Polygon): return [g]
    if isinstance(g, (MultiPolygon, GeometryCollection)): return [p for q in g.geoms for p in polys_of(q)]
    return []

def biggest(g): ps = polys_of(g); return max(ps, key=lambda p: p.area) if ps else None

def ring_list(p, nd=3):
    """Polygon -> [exterior, *holes] as lists of [x, y] (CCW exterior, open rings)."""
    p = shapely.geometry.polygon.orient(p, 1.0)
    rs = [list(p.exterior.coords)[:-1]] + [list(r.coords)[:-1] for r in p.interiors]
    return [[[round(x, nd), round(y, nd)] for x, y in r] for r in rs]

def tri(g, nd=3):
    """Constrained Delaunay triangulation of a (multi)polygon -> (verts [[x,y]], faces [[a,b,c]]) CCW."""
    V, F, idx = [], [], {}
    for p in polys_of(g):
        if p.area < 1e-4: continue
        p = shapely.make_valid(p)
        for q in polys_of(p):
            tris = shapely.constrained_delaunay_triangles(q)
            for t in tris.geoms:
                c = list(t.exterior.coords)[:3]
                a2 = (c[1][0] - c[0][0]) * (c[2][1] - c[0][1]) - (c[2][0] - c[0][0]) * (c[1][1] - c[0][1])
                if abs(a2) < 1e-8: continue
                if a2 < 0: c = [c[0], c[2], c[1]]
                f = []
                for x, y in c:
                    k = (round(x, nd), round(y, nd))
                    if k not in idx: idx[k] = len(V); V.append([k[0], k[1]])
                    f.append(idx[k])
                F.append(f)
    return V, F

def resample(line, step):
    L = line.length; n = max(1, int(math.ceil(L / step)))
    return [line.interpolate(i * L / n) for i in range(n + 1)]

# ------------------------------------------------------------------ 1. RTP from the CAD
R, BOX, M = cadlib.load(S + "/f4/flat.json", S + "/f4/clusters.json", 10, ROOT + "/review/frames.json")
LL = cadlib.layer_lines(R, BOX, M, cadlib.FAC)
def lines_of(layers, closed=None):
    out = []
    for l in LL:
        if l["L"] in layers and (closed is None or l["closed"] == closed) and len(l["pts"]) >= 2:
            out.append(LineString(l["pts"]))
    return out

FAC_ALL = ("STRUCTURAL GLAZING", "A.C.P.CLADDING", "A.C.P. CLADDING", "RCC  FINS", "WINDOW", "walls", "RAILING", "STRUCTURAL ASSEMBLY")
def outline(layers, buf=0.6):
    ls = lines_of(layers)
    blob = unary_union([l.buffer(buf) for l in ls])
    big = max(polys_of(blob), key=lambda g: Polygon(g.exterior).area)
    p = biggest(Polygon(big.exterior).buffer(-buf))
    return p.simplify(0.03)

P_SLAB = outline(FAC_ALL)
P_GLZ = outline(("STRUCTURAL GLAZING", "STRUCTURAL ASSEMBLY", "RCC  FINS", "WINDOW", "walls"))
P_GLZ = biggest(P_GLZ.intersection(P_SLAB.buffer(-0.15))).simplify(0.03)
print("slab outline", round(P_SLAB.area), "m2; glazing outline", round(P_GLZ.area), "m2; bounds", [round(v, 1) for v in P_SLAB.bounds])

# Overture footprint of RTP (to drop it from the context and for the footprint check)
CTX = json.load(open(S + "/ctx/context_overture.json"))
rtp_ov = None
for b in CTX["buildings"]:
    if b.get("name") == "Reliable Tech Park" or (len(b["ring"]) > 3 and Polygon(b["ring"]).is_valid and Polygon(b["ring"]).intersection(P_SLAB).area > 2000):
        g = Polygon(b["ring"])
        if rtp_ov is None or g.area > rtp_ov[1].area: rtp_ov = (b["id"], g)
print("RTP Overture footprint", rtp_ov[0], round(rtp_ov[1].area))

# floors
NLEV = 10; FTF = 3.6; FFL0 = 0.6
def ffl(n): return round(FFL0 + FTF * n, 3)
assume("floors", "G + 9 (levels 0-9), floor-to-floor 3.6 m, ground FFL +0.6 m, roof slab at +36.6 m, parapet to +37.8 m, drum tops ~42.6 m, dome apex ~46.5 m. "
       "Evidence: the brief's Overture dsm_excess for RTP is 47.7 m, which matches roof + drums + dome for G + 9 (G + 8 would top out near 43 m). "
       "But the raw Copernicus DSM, read here directly, peaks at only ~22 m over RTP (about 10 m above the surrounding ground): the 30 m radar pixels smear "
       "the building, or the 2011-15 survey predates parts of it, so the DSM alone cannot fix the count. Photos show 8-9 ribbons. G + 9 kept, as the brief "
       "says, pending the landlord's section drawing.")
xmin, ymin, xmax, ymax = P_SLAB.bounds
# rounded-end zones (half planes behind the start of each semicircle; arm half-width ~15 m)
south_c = (P_SLAB.intersection(sbox(xmin, ymin, xmax, ymin + 3)).centroid.x, ymin + 15.5)
west_c = (xmin + 15.5, P_SLAB.intersection(sbox(xmin, ymin, xmin + 3, ymax)).centroid.y)
Z_S = sbox(xmin - 5, ymin - 5, xmax + 5, south_c[1])
Z_W = sbox(xmin - 5, ymin - 5, west_c[0], ymax + 5)
ZONES = unary_union([Z_S, Z_W])
SETBACK = {8: 3.5, 9: 7.0}
assume("terraces", f"The rounded ends (south end of the east arm beyond y < {south_c[1]:.1f}, west end of the north arm beyond x < {west_c[0]:.1f}) "
       "step back 3.5 m at level 8 and 7.0 m at level 9 (from photos: stacked terraces near the top). Terraces get a 1.1 m glass balustrade.")

def terr(p, n, zpad=0.0):
    s = SETBACK.get(n, 0.0)
    if s <= 0: return p
    Z = ZONES.buffer(zpad, join_style=2) if zpad else ZONES
    inner = p.buffer(-s, join_style=1)
    return biggest(unary_union([p.difference(Z), inner.intersection(Z)]).buffer(0.01).buffer(-0.01)).simplify(0.03)

# lobby chamfer at the inner corner: the ground floor glazing follows the diagonal lobby glazing; canopy in front
inner_corner = None
cands = [(x, y) for x, y in P_SLAB.exterior.coords if 10 < x < 22 and 76 < y < 90]
if cands:
    inner_corner = min(cands, key=lambda q: (q[0] - 15.5) ** 2 + (q[1] - 83) ** 2)
else:
    inner_corner = (15.5, 83.0)
cx, cy = inner_corner
CHAMFER = Polygon([(cx - 9.0, cy + 0.05), (cx + 0.05, cy + 0.05), (cx + 0.05, cy - 9.0)])
assume("lobby", f"Main lobby at the inner corner ({cx:.1f}, {cy:.1f}): the CAD slab outline is square there, so the photos' chamfer is modelled as a "
       "double-height glass lobby (levels 0-1) filling the corner with a 45-degree face (9 m legs) toward the south-west court, and an entrance canopy "
       "at +4.8 m projecting further into the court.")

# columns: round structural columns between the glass line and the slab edge (the court-side colonnade)
round_cols = []
for l in LL:
    if l["L"] == "Structural Column" and l["circle"]:
        x, y, r = l["circle"]; pt = Point(x, y)
        if P_SLAB.buffer(0.2).contains(pt) and not P_GLZ.buffer(-0.3).contains(pt):
            round_cols.append([round(x, 3), round(y, 3), round(max(r, 0.25), 3)])
round_cols = [list(c) for c in {(c[0], c[1], c[2]) for c in round_cols}]
print("round columns outside the glass:", len(round_cols))

# fins (RCC FINS): line pairs 0.15 m apart -> solid panel rectangles
fin_polys = polys_of(unary_union([l.buffer(0.09, cap_style=2) for l in lines_of(("RCC  FINS",))]))
fin_polys = [p.simplify(0.02) for p in fin_polys if p.area > 0.1]
# ribs: STRUCTURAL ASSEMBLY small closed rectangles (0.13 x 1.3-1.8 m) -> vertical ribs
ribs = []
for l in LL:
    if l["L"] == "STRUCTURAL ASSEMBLY" and l["closed"] and len(l["pts"]) >= 4:
        p = Polygon(l["pts"])
        if p.is_valid and 0.05 < p.area < 1.0: ribs.append(p.simplify(0.01))
print("fins", len(fin_polys), "ribs", len(ribs))

# mullion module from the STRUCTURAL ASSEMBLY grid polyline (vertex spacing = bay)
segs = []
for l in LL:
    if l["L"] == "STRUCTURAL ASSEMBLY" and not l["closed"] and len(l["pts"]) >= 3:
        d = np.linalg.norm(np.diff(l["pts"], axis=0), axis=1); segs += [float(v) for v in d if 6 < v < 15]
BAY = float(np.median(segs)) if segs else 11.76
MOD = BAY / max(1, round(BAY / 1.4))
assume("mullions", f"Curtain-wall module = structural bay {BAY:.2f} m (median vertex spacing of the STRUCTURAL ASSEMBLY polylines) split into {round(BAY / MOD)} panels = {MOD:.3f} m; "
       "mullions 60 x 140 mm, 76 mm proud of the glass; no transoms (structural glazing reads as flush ribbons).")

# spine: the court-side bulge of the east arm (opposite the cores) -> grey vertical ribbed spine
bulge = P_SLAB.intersection(sbox(xmin, 26, south_c[0] - 12, 54))
SPINE = sbox(5, 27.5, 17.5, 52.5)
assume("spine", "The 'central grey vertical spine with ribbed elements' of the photos is placed on the court-side bulge of the east arm "
       "(y 27.5-52.5 m, where Core 1/2 meet the facade): grey ACP piers 0.3 m deep every 1.2 m, running through all floors.")

def facade_runs(pg, n):
    """Split the glazing ring of polygon pg into tagged runs: glass / solid (behind RCC fins)."""
    ring = shapely.geometry.polygon.orient(pg, 1.0).exterior
    pts = resample(ring, 0.25)
    fin_u = unary_union([f.buffer(0.6) for f in fin_polys]) if fin_polys else None
    tags = []
    for p in pts:
        t = "glass"
        if fin_u is not None and fin_u.contains(p): t = "solid"
        if n == 0 and CHAMFER.buffer(0.5).contains(p): t = "lobby"
        tags.append(t)
    runs, cur = [], None
    for p, t in zip(pts, tags):
        if cur is None or cur["tag"] != t:
            if cur is not None: cur["pts"].append([round(p.x, 3), round(p.y, 3)])
            cur = {"tag": t, "pts": []}; runs.append(cur)
        cur["pts"].append([round(p.x, 3), round(p.y, 3)])
    return runs

def mullions(pg, step, phase=0.0):
    ring = shapely.geometry.polygon.orient(pg, 1.0).exterior; L = ring.length; n = int(L / step)
    out = []
    for i in range(n):
        s = (i + 0.5) * L / n
        a = ring.interpolate(s); b = ring.interpolate(min(L, s + 0.05)); c = ring.interpolate(max(0, s - 0.05))
        tx, ty = b.x - c.x, b.y - c.y; k = math.hypot(tx, ty) or 1
        out.append([round(a.x, 3), round(a.y, 3), round(math.atan2(ty / k, tx / k), 4)])
    return out

floors = []
for n in range(NLEV + 1):
    slab_poly = terr(P_SLAB, n - 1) if n >= 1 else P_SLAB           # slab of level n = roof of level n-1
    if n == NLEV: slab_poly = terr(P_SLAB, NLEV - 1)
    glass_poly = terr(P_GLZ, n, zpad=0.3) if n < NLEV else None     # glass steps 0.3 m inside the band step (no coincident jog faces)
    if glass_poly is not None and SETBACK.get(n, 0) > 0:
        glass_poly = biggest(glass_poly.intersection(terr(P_SLAB, n).buffer(-0.15, join_style=2))).simplify(0.03)
    if n == 0: glass_poly = biggest(P_GLZ.difference(CHAMFER)).simplify(0.03)
    band_poly = terr(P_SLAB, n) if n < NLEV else slab_poly           # ACP band of the floor's own edge
    f = {"level": n, "ffl": ffl(n), "name": f"rtp_L{n:02d}" if n < NLEV else "rtp_ROOF",
         "slab": ring_list(slab_poly.buffer(-0.03, join_style=2)), "slab_tri": tri(slab_poly.buffer(-0.03, join_style=2)),
         "band": ring_list(slab_poly), "band_own": ring_list(band_poly)}
    if glass_poly is not None:
        f["glass"] = ring_list(glass_poly); f["runs"] = facade_runs(glass_poly, n)
        fin_keep = unary_union([g.buffer(0.3) for g in fin_polys + ribs])
        f["mullions"] = [m for m in mullions(glass_poly, MOD) if not fin_keep.contains(Point(m[0], m[1]))]
        f["interior"] = ring_list(glass_poly.buffer(-0.9, join_style=2))
        # terrace / exposed slab beyond the glass: balustrade where slab edge is > 1.0 m from the glass (setback floors only)
        if SETBACK.get(n, 0) > 0:
            ex = slab_poly.exterior
            rail = ex.difference(glass_poly.buffer(1.2)).intersection(ZONES.buffer(1.0))
            f["rail"] = [[[round(x, 3), round(y, 3)] for x, y in g.coords] for g in getattr(rail, "geoms", [rail]) if g.length > 1.0]
        # spine piers on this floor
        f["spine"] = [m for m in mullions(glass_poly, 1.2) if SPINE.contains(Point(m[0], m[1]))]
    floors.append(f)
# drums, dome, sign
roof_z = ffl(NLEV)
DRUMS = [{"name": "drum_south", "c": [round(south_c[0], 2), round(south_c[1] + 1.0, 2)], "r": 6.5, "z0": roof_z, "h": 6.0, "dome": True},
         {"name": "drum_west", "c": [round(west_c[0] + 1.0, 2), round(west_c[1], 2)], "r": 6.5, "z0": roof_z, "h": 6.0, "dome": False}]
SIGN = {"drum": "drum_west", "text": "RELIABLE", "facing_deg_from_east": 200.0, "letter_h": 2.1}
assume("roof", "Two roof drums (radius 6.5 m, 6 m tall) centred on the two rounded ends; the white dome (6.5 m radius, 0.6 rise ratio) is on the south drum; "
       "the red RELIABLE sign with a white R logo wraps the west drum, facing south-south-west (court and Thane-Belapur Road). Positions are from photo reading, not drawings.")

rtp = {"slab_outline": ring_list(P_SLAB), "glass_outline": ring_list(P_GLZ), "overture_ring": ring_list(rtp_ov[1]), "overture_id": rtp_ov[0],
       "floors": floors, "round_cols": round_cols, "fins": [ring_list(p) for p in fin_polys], "ribs": [ring_list(p) for p in ribs],
       "module": MOD, "bay": BAY, "drums": DRUMS, "sign": SIGN, "chamfer": ring_list(CHAMFER), "inner_corner": [cx, cy],
       "zones": {"south_c": south_c, "west_c": west_c}, "nlev": NLEV, "ftf": FTF, "ffl0": FFL0, "roof_z": roof_z,
       "canopy": ring_list(Polygon([(cx - 15, cy), (cx, cy), (cx, cy - 15)]).buffer(-0.01).difference(P_SLAB.buffer(-0.1)).buffer(0))}

# ------------------------------------------------------------------ 2. Terrain (Copernicus GLO-30, both tiles)
import rasterio
from rasterio.merge import merge
srcs = [rasterio.open(S + "/ctx/.dsm_N19_00_E073_00.tif"), rasterio.open(ROOT + "/exterior/_build/dl/dsm_N19_E072.tif")]
dlat = 3200 / KY; dlon = 3200 / KX
dsm, tr = merge(srcs, bounds=(LON0 - dlon, LAT0 - dlat, LON0 + dlon, LAT0 + dlat)); dsm = dsm[0].astype(np.float32)
H, W = dsm.shape
lon_c = tr.c + tr.a * (np.arange(W) + 0.5); lat_c = tr.f + tr.e * (np.arange(H) + 0.5)
gx = (lon_c - LON0) * KX; gy = (lat_c - LAT0) * KY
from numpy.lib.stride_tricks import sliding_window_view as swv
def minf(a, k):
    p = k // 2; ap = np.pad(a, p, mode="edge"); return swv(ap, (k, k)).min(axis=(2, 3))
def meanf(a, k):
    p = k // 2; ap = np.pad(a, p, mode="edge"); return swv(ap, (k, k)).mean(axis=(2, 3))
ground = meanf(minf(dsm, 5), 5)                     # ~150 m opening then smoothing: removes buildings and trees
# keep hills: where the DSM is far above the opened ground over large areas it is terrain, not buildings
hill = meanf(dsm, 7)
far = np.hypot(*np.meshgrid(gx, gy)) > 700.0              # only the distant relief (the Parsik hills), not tall buildings near the site
ground = np.where(far & (hill - ground > 25), 0.6 * hill + 0.4 * ground, ground)
ground = meanf(ground, 3)
def sample(a, x, y):
    j = np.clip(np.interp(x, gx, np.arange(W)), 0, W - 1); i = np.clip(np.interp(y, gy[::-1], np.arange(H)[::-1]), 0, H - 1)
    i0, j0 = np.floor(i).astype(int), np.floor(j).astype(int); i1, j1 = np.minimum(i0 + 1, H - 1), np.minimum(j0 + 1, W - 1); fi, fj = i - i0, j - j0
    return (a[i0, j0] * (1 - fi) * (1 - fj) + a[i0, j1] * (1 - fi) * fj + a[i1, j0] * fi * (1 - fj) + a[i1, j1] * fi * fj)
site_ground = float(np.median(sample(ground, np.array([0, 30, -30, 20, -20.]), np.array([40, 0, 0, 100, 60.]))))
print("site ground elevation (DTM estimate):", round(site_ground, 1))
# terrain grid in rtp_local, 3.2 km half-size, 40 m spacing in the far field
N = 161; ax_ = np.linspace(-3200, 3200, N); TX, TY = np.meshgrid(ax_, ax_)
TZ = sample(ground, TX.ravel(), TY.ravel()).reshape(TX.shape) - site_ground
rr = np.hypot(TX, TY)
FLAT_R0, FLAT_R1 = 560.0, 1000.0
wgt = np.clip((rr - FLAT_R0) / (FLAT_R1 - FLAT_R0), 0, 1); wgt = wgt * wgt * (3 - 2 * wgt)
TZ = TZ * wgt - 0.35 * (1 - wgt)                     # flat at -0.35 m under the detailed ground disc (no coplanar overlap)
assume("terrain", f"Ground model = Copernicus DSM opened with a 150 m minimum filter (removes buildings) and smoothed; hills kept where the surface "
       f"rises > 25 m over 210 m. Relative to the site ground ({site_ground:.1f} m). Flat inside {FLAT_R0:.0f} m (the detailed context disc), blended to the "
       f"real relief by {FLAT_R1:.0f} m, so the Parsik hills east of the site form the skyline. The second tile (N19 E072, west of 73.0 E) was fetched from the public Copernicus bucket.")
# simple horizon AO for the terrain vertices
def terrain_ao(Z, step):
    gzy, gzx = np.gradient(Z, step); slope = np.hypot(gzx, gzy)
    curv = meanf(Z, 5) - Z
    return np.clip(1.0 - 0.6 * np.clip(curv / 15.0, 0, 1) - 0.15 * np.clip(slope, 0, 1), 0.35, 1.0)
TAO = terrain_ao(TZ, ax_[1] - ax_[0])
np.savez_compressed(os.path.join(OUT, "terrain.npz"), x=ax_, z=TZ.astype(np.float32), ao=TAO.astype(np.float32))

# ------------------------------------------------------------------ 3. Context: buildings
OSM = json.load(open(S + "/ctx/osm.json"))["elements"]
def osm_geom(e): return [ll2xy(q["lat"], q["lon"]) for q in e.get("geometry", [])]
landuse = []
rails = []
for e in OSM:
    t = e.get("tags", {}); g = osm_geom(e)
    if len(g) < 2: continue
    if "landuse" in t and len(g) >= 4:
        p = shapely.make_valid(Polygon(g)); landuse.append({"kind": t["landuse"], "name": t.get("name", ""), "poly": p})
    if t.get("railway") in ("rail",): rails.append(LineString(g))
DISC_R = 560.0
DISC = Point(0, 0).buffer(DISC_R, 64)
CTX_R = 520.0

def dsm_height(p):
    """Building height from the DSM: 90th percentile of DSM pixels inside (or nearest to) the footprint minus local ground."""
    b = p.bounds
    j0, j1 = np.searchsorted(gx, b[0] - 15), np.searchsorted(gx, b[2] + 15)
    i_lo, i_hi = np.searchsorted(gy[::-1], b[1] - 15), np.searchsorted(gy[::-1], b[3] + 15)
    ii = np.arange(H)[::-1][i_lo:i_hi]
    vals = []
    for i in ii:
        for j in range(j0, j1):
            if p.buffer(8).contains(Point(gx[j], gy[i])): vals.append(dsm[i, j] - ground[i, j])
    if not vals:
        c = p.centroid; vals = [float(sample(dsm, np.array([c.x]), np.array([c.y]))[0] - sample(ground, np.array([c.x]), np.array([c.y]))[0])]
    return float(np.percentile(vals, 90))

rtp_poly = P_SLAB.buffer(3)
B = []
for b in CTX["buildings"]:
    if len(b["ring"]) < 4: continue
    p = shapely.make_valid(Polygon(b["ring"])); p = biggest(p)
    if p is None or p.area < 12: continue
    c = p.centroid; d = math.hypot(c.x, c.y)
    if d > CTX_R: continue
    if b["id"] == rtp_ov[0] or p.intersection(rtp_poly).area > 0.3 * p.area: continue
    B.append({"src": b, "poly": p.simplify(0.15), "d": d, "d_rtp": p.distance(P_SLAB)})
# Overture has a few overlapping footprints: larger ones keep their shape, smaller ones lose the overlap
B.sort(key=lambda k: -k["poly"].area); acc = []; acc_tree = None; kept = []
for k in B:
    near = [a for a in acc if a.intersects(k["poly"])]
    g = k["poly"]
    if near:
        ov = g.intersection(unary_union(near)).area
        if ov > 0.01 * g.area: g = biggest(g.difference(unary_union(near)))
    if g is None or g.area < 12: continue
    k["poly"] = g.simplify(0.05); acc.append(k["poly"]); kept.append(k)
B = kept
print("context buildings within", CTX_R, "m:", len(B))
# zones
cr = [r for r in CTX["roads"] if r["class"] in ("secondary",) and "Central" in (r.get("name") or "")]
central = unary_union([LineString(r["line"]) for r in cr]) if cr else None
def east_of_central(pt):
    if central is None: return pt.x > 150
    q = nearest_points(central, pt)[0]; return pt.x > q.x
# heights + classes
names_b = []
for k in B:
    p = k["poly"]; s = k["src"]; area = p.area; hd = dsm_height(p)
    k["h_dsm"] = round(hd, 1)
    named = s.get("name")
    mrr = p.minimum_rotated_rectangle; ex = list(mrr.exterior.coords)
    e1 = math.dist(ex[0], ex[1]); e2 = math.dist(ex[1], ex[2]); k["dims"] = sorted([e1, e2])
    if (k["d_rtp"] <= 200 and (area >= 900 or named)) or named:
        k["cls"] = "B"
    else:
        k["cls"] = "C"
for k in B:
    p = k["poly"]; s = k["src"]; area = p.area; hd = k["h_dsm"]; c = p.centroid
    if k["cls"] == "B":
        ov = s.get("dsm_excess_m") or 0
        if s.get("floors"): fl = int(s["floors"]); src = "OSM building:levels"
        elif 10 < ov < 60 and c.x < 150: fl = int(np.clip(round((ov - 1.2) / 3.6), 3, 16)); src = f"Overture dsm_excess {ov} m"
        else: fl = 6 if p.area > 2500 else 4; src = "assumed (no usable height in the open data)"
        k["floors"] = fl; k["ftf"] = 3.6; k["h"] = round(fl * 3.6 + 1.2, 1); k["h_src"] = src
    else:
        bump = 1 if hd > 9 else 0           # the 30 m DSM only separates the clearly taller blocks
        if area >= 450 and not east_of_central(c) and (area > 1200 or c.y < -150):
            k["type"] = "shed"; k["h"] = round(RNG.uniform(7.5, 11.0), 1); k["floors"] = 1; k["h_src"] = "assumed (type default)"
        elif area >= 250:
            fl = RNG.choice([3, 4, 4, 5, 5, 6]) + bump; k["type"] = "block"; k["floors"] = fl; k["ftf"] = 3.1; k["h"] = round(fl * 3.1 + 0.9, 1); k["h_src"] = "assumed (type default)"
        else:
            if area < 40: w = [1, 1, 1, 2]
            elif area < 120: w = [1, 2, 2, 2, 3]
            else: w = [2, 2, 3, 3, 4]
            fl = min(4, RNG.choice(w) + bump)
            k["type"] = "house"; k["floors"] = fl; k["ftf"] = 3.0; k["h"] = round(fl * 3.0 + RNG.uniform(0.2, 0.6), 1); k["h_src"] = "assumed (type default)"
# Class B naming and facade types (named from the brief; positions decided here and logged)
Bb = sorted([k for k in B if k["cls"] == "B"], key=lambda k: k["d_rtp"])
west_slabs = sorted([k for k in Bb if k["poly"].centroid.x < -60 and -200 < k["poly"].centroid.y < 120 and k["poly"].area > 1500 and not k["src"].get("name")], key=lambda k: math.hypot(k["poly"].centroid.x + 200, k["poly"].centroid.y))
for k in Bb: k["label"] = k["src"].get("name") or ""
for k in Bb:
    if k["label"] == "Liberty Tower" and not k["src"].get("floors"): k["label"] = "Liberty Tower annexe"
lib = [k for k in Bb if "Liberty" in (k["label"] or "") and k["src"].get("floors")]
lib_k = lib[0] if lib else None
if lib_k and lib_k in west_slabs: west_slabs.remove(lib_k)
for k, nm in zip(west_slabs[:2], ("Sutherland (assumed position)", "BSV (assumed position)")):
    if not k["label"]: k["label"] = nm
others = [k for k in Bb if not k["label"]]
pool = ["Lumina CloudInfra DC (assumed position)", "Gramercy Techpark (assumed position)", "Clover Infotech (assumed position)"]
# the data centre is the bulkiest low building, the two techparks the tallest remaining
if others:
    dc = max(others, key=lambda k: k["poly"].area / max(1.0, k["h"])); dc["label"] = pool[0]; others.remove(dc)
    for k, nm in zip(sorted(others, key=lambda k: -k["h"])[:2], pool[1:]): k["label"] = nm
for k in Bb:
    lab = k["label"]
    if "Lumina" in lab: k["facade"] = "industrial"
    elif any(w in lab for w in ("Liberty", "Gramercy", "Sutherland", "BSV", "Empire", "Mindspace")): k["facade"] = "glass"
    elif "Clover" in lab: k["facade"] = "glass"
    elif k["h"] < 14 and k["poly"].area > 1500: k["facade"] = "industrial"
    else: k["facade"] = "punched"
    if not lab: k["label"] = f"office block ({k['facade']})"
    names_b.append((k["label"], round(k["poly"].centroid.x), round(k["poly"].centroid.y), k["h"], k["h_src"], k["facade"], round(k["poly"].area)))
assume("class_b", "Overture/OSM name only Liberty Tower (10 floors) and Empire Tower near the site. Sutherland is given to the large unnamed slab block "
       "west of RTP (BSV could not be placed: no second free slab block of that size west of RTP, so it is not labelled); Lumina CloudInfra DC to the bulkiest low building within 200 m and Gramercy to the tallest remaining one (Clover not placed: no further large building within 200 m). "
       "These positions are NOT verified and must be checked against the client's site list. Class B: " + "; ".join(f"{a} at ({x},{y}) h {h} m [{s}], {f}" for a, x, y, h, s, f, _ in names_b))
# the glass tower on a car park: the tallest Class B building gets a 4-level louvred parking podium
podium = None
if Bb:
    tall = max(Bb, key=lambda k: k["h"])
    tall["podium"] = 4; podium = tall["label"]
    assume("car_park", f"The multi-level car park with a louvred facade under a glass tower is modelled as a 4-level perforated-metal podium under {tall['label']} "
           f"(the tallest Class B building, {tall['h']} m). Which neighbour it really is, is not in the open data.")

def roof_kind(k):
    c = k["poly"].centroid
    if k["cls"] == "B": return "terrace"
    if k["type"] == "shed": return RNG.choice(["shed_gable", "shed_gable", "shed_mono"])
    if k["type"] == "block": return "terrace"
    r = RNG.random()
    if east_of_central(c): return "tin" if r < 0.42 else ("terracotta" if r < 0.6 else "terrace")
    return "tin" if r < 0.3 else ("terracotta" if r < 0.4 else "terrace")
bld_out = []
for k in B:
    p = k["poly"]; k["roof"] = roof_kind(k)
    mrr = p.minimum_rotated_rectangle; ex = list(mrr.exterior.coords)
    ang = math.atan2(ex[1][1] - ex[0][1], ex[1][0] - ex[0][0]) if math.dist(ex[0], ex[1]) >= math.dist(ex[1], ex[2]) else math.atan2(ex[2][1] - ex[1][1], ex[2][0] - ex[1][0])
    rect = p.area / max(mrr.area, 1e-6) > 0.92 and mrr.exterior.hausdorff_distance(p.exterior) < 0.9
    o = {"id": k["src"]["id"], "cls": k["cls"], "type": k.get("type", "office"), "facade": k.get("facade", ""), "label": k.get("label", ""),
         "ring": ring_list(p, 2), "tri": tri(p, 2), "h": k["h"], "floors": k["floors"], "ftf": k.get("ftf", 3.6), "h_src": k["h_src"], "h_dsm": k["h_dsm"],
         "roof": k["roof"], "axis": round(ang, 4), "rect": rect, "mrr": [[round(x, 2), round(y, 2)] for x, y in ex[:4]],
         "d": round(k["d"], 1), "d_rtp": round(k["d_rtp"], 1), "podium": k.get("podium", 0), "seed": RNG.randrange(1 << 30), "area": round(p.area, 1)}
    if k["roof"] == "terrace":
        inner = p.buffer(-0.25, join_style=2)
        o["parapet_in"] = ring_list(biggest(inner), 2) if biggest(inner) is not None and biggest(inner).area > 4 else None
        # rooftop clutter: water tanks + stair head on terraces
        tanks = []
        if p.area > 25:
            nt = 1 if p.area < 150 else (2 if p.area < 400 else 4)
            ip = p.buffer(-1.2)
            for _ in range(nt * 4):
                if len(tanks) >= nt or ip.is_empty: break
                bx = ip.bounds; q = Point(RNG.uniform(bx[0], bx[2]), RNG.uniform(bx[1], bx[3]))
                if ip.contains(q) and all(math.dist((q.x, q.y), t[:2]) > 1.6 for t in tanks): tanks.append([round(q.x, 2), round(q.y, 2), RNG.choice([0, 0, 1])])
        o["tanks"] = tanks
        o["stairhead"] = None
        if p.area > 90 and k["cls"] == "C" and RNG.random() < 0.55:
            ip = p.buffer(-1.0)
            if not ip.is_empty:
                q = biggest(ip).representative_point(); o["stairhead"] = [round(q.x, 2), round(q.y, 2), round(ang, 3)]
    bld_out.append(o)
print("Class B:", sum(1 for o in bld_out if o["cls"] == "B"), "Class C:", sum(1 for o in bld_out if o["cls"] == "C"))

# ------------------------------------------------------------------ 4. Roads, ground partition, markings
WID = {"primary": 9.5, "secondary": 12.0, "tertiary": 9.0, "residential": 6.0, "living_street": 4.5, "service": 5.0, "unknown": 5.0, "secondary_link": 7.0, "track": 3.5}
road_lines = {}
for r in CTX["roads"]:
    c = r["class"]
    if c not in WID: continue
    ln = LineString(r["line"]).intersection(DISC.buffer(-2))
    if ln.is_empty: continue
    road_lines.setdefault(c, []).append({"g": ln, "name": r.get("name") or ""})
def buf_class(c, extra=0.0):
    return unary_union([l["g"].buffer(WID[c] / 2 + extra, cap_style=1, join_style=1) for l in road_lines.get(c, [])])
prim = buf_class("primary")
prim_closed = prim.buffer(13, join_style=1).buffer(-13, join_style=1)
median = prim_closed.difference(prim.buffer(0.3)).intersection(DISC)
median = unary_union([m for m in polys_of(median) if m.area > 40 and m.minimum_rotated_rectangle.length > 60])
print("median strips", len(polys_of(median)), round(median.area), "m2")
assume("roads", "Road widths by OSM class: primary carriageway 9.5 m (3 lanes) per direction, secondary 12 m, tertiary 9 m, residential 6 m, "
       "living street 4.5 m, service 5 m. Thane-Belapur Road's two one-way carriageways get a planted median where they run within 26 m of each other. "
       "Footpaths 2.5 m with 150 mm kerbs on primary/secondary/tertiary roads, 1.5 m elsewhere.")
roads_all = unary_union([buf_class(c) for c in road_lines]).intersection(DISC)
roads_all = roads_all.difference(median)
# keep the roads off the building footprints (Overture rings sometimes overlap the OSM centrelines)
bld_union = unary_union([b["poly"] for b in B] + [P_SLAB])
foot_major = unary_union([buf_class(c, 2.5) for c in ("primary", "secondary", "tertiary", "secondary_link")]).union(median.buffer(0.01))
foot_minor = unary_union([buf_class(c, 1.5) for c in ("residential", "service", "unknown", "living_street")])
footpath = unary_union([foot_major, foot_minor.difference(foot_major)]).difference(roads_all).difference(median).difference(bld_union.buffer(0.3)).intersection(DISC)
footpath = unary_union([p for p in polys_of(footpath) if p.area > 2])
# railway
rail_bed = unary_union([l.buffer(6.0) for l in rails]).intersection(DISC).difference(roads_all).difference(footpath) if rails else Polygon()
# campus court: the inner L between the two arms, south-west of the lobby
court = Polygon([(-56, 84), (15.4, 84), (15.4, -8), (-56, -8)]).difference(P_SLAB.buffer(0.5)).difference(roads_all).difference(footpath)
court = biggest(court)
green_ov = [shapely.make_valid(Polygon(g["ring"])) for g in CTX["green"] if len(g["ring"]) >= 4]
small_green = [g for g in green_ov if g.intersects(court) and g.area < 5000] if court is not None else []
lawn = unary_union([court.buffer(-13, join_style=1)] + [g.intersection(court.buffer(-6)) for g in small_green]) if court is not None else Polygon()
lawn = biggest(lawn) if lawn is not None and not lawn.is_empty else Polygon()
parking = court.difference(lawn.buffer(1.5)) if court is not None else Polygon()
assume("court", "The court inside the L is paved surface parking around a landscaped lawn (the Overture 'playground' polygon), palms along the lawn edge; "
       "parking bays 2.5 x 5 m on the paved part. Layout is assumed (no site plan).")
# ground partition by land use
LU_MAT = {"industrial": "ground_industrial", "commercial": "ground_compound", "residential": "ground_dirt", "construction": "ground_construction"}
GR_MAT = {"forest/": "ground_forest", "shrub/": "ground_scrub", "crop/": "ground_crop", "recreation/playground": "ground_lawn"}
taken = unary_union([roads_all, median, footpath, rail_bed, P_SLAB.buffer(-0.05)])
parts = []
def add_part(mat, g):
    global taken
    g = g.intersection(DISC).difference(taken)
    g = unary_union([p for p in polys_of(g) if p.area > 0.5])
    if g.is_empty: return
    parts.append({"mat": mat, "g": g}); taken = unary_union([taken, g])
add_part("ground_court_paving", parking if parking is not None else Polygon())
add_part("ground_lawn", lawn)
# pond (north-west, assumed) and substation (west of the road, assumed): pick free areas
def free_spot(region, size, avoid):
    bx = region.bounds; best = None
    for _ in range(4000):
        x, y = RNG.uniform(bx[0], bx[2]), RNG.uniform(bx[1], bx[3]); s = sbox(x - size[0] / 2, y - size[1] / 2, x + size[0] / 2, y + size[1] / 2)
        if region.contains(s) and not s.intersects(avoid):
            d = math.hypot(x, y)
            if best is None or d < best[0]: best = (d, s)
    return best[1] if best else None
avoid = unary_union([bld_union.buffer(4), roads_all.buffer(3), rail_bed.buffer(2), footpath])
west_region = Polygon([(-900, -300), (-330, -300), (-330, 600), (-900, 600)])
sub = free_spot(west_region, (120, 90), avoid)
nw_region = Polygon([(-330, 120), (-60, 120), (-60, 540), (-330, 540)]).intersection(DISC)
pond_box = free_spot(nw_region, (75, 50), avoid.union(sub.buffer(10) if sub else Polygon()))
pond = None
if pond_box is not None:
    c = pond_box.centroid
    pts = [(c.x + 36 * math.cos(a) * (1 + 0.12 * math.sin(3 * a + 1)), c.y + 23 * math.sin(a) * (1 + 0.1 * math.cos(2 * a))) for a in np.linspace(0, 2 * math.pi, 48, endpoint=False)]
    pond = Polygon(pts)
assume("substation_pond", f"OSM here has no power or water tags. The 220 kV Kalwa substation is placed as a 120 x 90 m switchyard on the nearest free ground "
       f"west of Thane-Belapur Road (centre {tuple(round(v) for v in sub.centroid.coords[0]) if sub else None}); the pond as a 72 x 46 m pond on free ground to the north-west "
       f"(centre {tuple(round(v) for v in pond.centroid.coords[0]) if pond else None}). Both positions are illustrative and must be checked.")
if pond is not None:
    add_part("ground_mud", pond.buffer(3.0).difference(pond)); add_part("water", pond)
if sub is not None: add_part("ground_gravel", sub)
# plots around buildings: hard standing within 3 m of every building (compounds, chowks)
add_part("ground_compound", bld_union.buffer(3.0))
greens = [(GR_MAT.get(x["kind"], "ground_scrub"), shapely.make_valid(Polygon(x["ring"]))) for x in CTX["green"] if len(x["ring"]) >= 4]
for m_, g in greens:
    if g.area <= 150000: add_part(m_, g)
for lu in landuse: add_part(LU_MAT.get(lu["kind"], "ground_dirt"), lu["poly"])
for m_, g in greens:
    if g.area > 150000: add_part(m_, g)          # very large land-cover polygons only fill what is left
add_part("ground_base", DISC)
ground_parts = [{"mat": p["mat"], "tri": tri(p["g"], 3)} for p in parts]
road_tri = tri(roads_all, 3); median_tri = tri(median, 3); foot_tri = tri(footpath, 3); rail_tri = tri(rail_bed, 3)
kerb_rings = [ring_list(p, 3) for p in polys_of(footpath)] + [ring_list(p, 3) for p in polys_of(median)]
# lane markings (dash rectangles as centre + direction + length + width)
marks = []
def dashes(ln, off, dash, gap, w):
    try: o = ln.offset_curve(off, join_style=2) if off else ln
    except Exception: return
    for g in getattr(o, "geoms", [o]):
        L = g.length; s = 2.0
        while s + dash < L - 2:
            a = g.interpolate(s); b = g.interpolate(s + dash); marks.append([round(a.x, 2), round(a.y, 2), round(b.x, 2), round(b.y, 2), w]); s += dash + gap
for c, ls in road_lines.items():
    for l in ls:
        for g in getattr(l["g"], "geoms", [l["g"]]):
            if g.length < 8: continue
            if c == "primary":
                for off in (-1.58, 1.58): dashes(g, off, 3.0, 6.0, 0.15)
                for off in (-4.35, 4.35): dashes(g, off, 12.0, 0.01, 0.15)
            elif c in ("secondary", "tertiary"):
                dashes(g, 0.0, 3.0, 5.0, 0.12)
                for off in (-WID[c] / 2 + 0.4, WID[c] / 2 - 0.4): dashes(g, off, 12.0, 0.01, 0.12)
# keep only markings on the carriageway
road_prep = shapely.prepared.prep(roads_all.buffer(-0.2))
marks = [m for m in marks if road_prep.contains(Point((m[0] + m[2]) / 2, (m[1] + m[3]) / 2))]
# union the dashes (crossing roads would otherwise stack two marking quads) and triangulate
mark_union = unary_union([LineString([(m[0], m[1]), (m[2], m[3])]).buffer(m[4] / 2, cap_style=2) for m in marks]).intersection(roads_all)
marks_tri = tri(mark_union, 3)
# zebra crossings where majors meet the campus / at junction stubs: a few at the RTP gate on the service road ends near Thane-Belapur Road (skipped if none)

# ------------------------------------------------------------------ 5. Props: trees, palms, lamps, cars, buses, pylons
props = {"palm": [], "tree": [], "tree_small": [], "shrub": [], "lamp": [], "lamp_double": [], "car": [], "bus": [], "pylon": [], "rail_mast": [], "bollard": []}
occupied = unary_union([bld_union.buffer(1.5), roads_all, rail_bed]).buffer(0)
occ_p = shapely.prepared.prep(occupied)
def put(kind, x, y, rot=None, s=1.0, v=0):
    props[kind].append([round(x, 2), round(y, 2), round(rot if rot is not None else RNG.uniform(0, 2 * math.pi), 3), round(s, 2), v])
# palms around the court lawn edge and along the RTP frontage
if lawn is not None and not lawn.is_empty:
    for g in polys_of(lawn):
        for p in resample(g.exterior, 8.0)[:-1]:
            put("palm", p.x, p.y, s=RNG.uniform(0.9, 1.15), v=RNG.randrange(3))
        ip = g.buffer(-6)
        for _ in range(int(g.area / 120)):
            bx = g.bounds; q = Point(RNG.uniform(bx[0], bx[2]), RNG.uniform(bx[1], bx[3]))
            if ip.contains(q): put("shrub", q.x, q.y, s=RNG.uniform(0.8, 1.4), v=RNG.randrange(3))
for p in resample(LineString([(-54, -6), (14, -6)]), 9.0): put("palm", p.x, p.y, s=RNG.uniform(0.9, 1.1), v=RNG.randrange(3))
for p in resample(LineString([(-54, -6), (-54, 82)]), 9.0): put("palm", p.x, p.y, s=RNG.uniform(0.9, 1.1), v=RNG.randrange(3))
# avenue trees on footpaths of major roads (both sides), palms + shrubs on the median
for c in ("primary", "secondary", "tertiary"):
    for l in road_lines.get(c, []):
        for g in getattr(l["g"], "geoms", [l["g"]]):
            for side in (-1, 1):
                try: o = g.offset_curve(side * (WID[c] / 2 + 1.6))
                except Exception: continue
                for og in getattr(o, "geoms", [o]):
                    for i, p in enumerate(resample(og, 14.0)):
                        if occ_p.intersects(p.buffer(1.0)) or median.contains(p): continue
                        put("tree" if RNG.random() < 0.7 else "tree_small", p.x, p.y, s=RNG.uniform(0.8, 1.2), v=RNG.randrange(4))
            for i, p in enumerate(resample(g, 30.0)):
                for side in (-1, 1):
                    try: o = g.offset_curve(side * (WID[c] / 2 + 0.6))
                    except Exception: continue
                    q = o.interpolate(o.project(p)) if not o.is_empty else None
                    if q is not None and not occ_p.contains(q):
                        a = math.atan2(p.y - q.y, p.x - q.x); put("lamp", q.x, q.y, rot=a)
for m in polys_of(median):
    sk = m.buffer(-0.8)
    if sk.is_empty: continue
    ln = sk.minimum_rotated_rectangle; ex = list(ln.exterior.coords)
    axis = LineString([((ex[0][0] + ex[1][0]) / 2, (ex[0][1] + ex[1][1]) / 2), ((ex[2][0] + ex[3][0]) / 2, (ex[2][1] + ex[3][1]) / 2)]) if math.dist(ex[0], ex[1]) < math.dist(ex[1], ex[2]) else \
        LineString([((ex[1][0] + ex[2][0]) / 2, (ex[1][1] + ex[2][1]) / 2), ((ex[3][0] + ex[0][0]) / 2, (ex[3][1] + ex[0][1]) / 2)])
    for i, p in enumerate(resample(axis, 4.0)):
        if not sk.contains(p): continue
        if i % 9 == 0: put("lamp_double", p.x, p.y, rot=math.atan2(axis.coords[1][1] - axis.coords[0][1], axis.coords[1][0] - axis.coords[0][0]))
        elif i % 3 == 0: put("palm", p.x, p.y, s=RNG.uniform(0.8, 1.0), v=RNG.randrange(3))
        else: put("shrub", p.x, p.y, s=RNG.uniform(0.7, 1.1), v=RNG.randrange(3))
# scatter trees in green areas and free ground
for pa in parts:
    dens = {"ground_forest": 55, "ground_scrub": 120, "ground_crop": 380, "ground_base": 320, "ground_dirt": 520, "ground_industrial": 1400, "ground_lawn": 0,
            "ground_compound": 650, "ground_court_paving": 0, "ground_gravel": 0, "water": 0, "ground_mud": 400, "ground_paved": 1800, "ground_construction": 0}.get(pa["mat"], 0)
    if not dens: continue
    g = pa["g"]; n = int(g.area / dens); bx = g.bounds; gp = shapely.prepared.prep(g.buffer(-2))
    for _ in range(n * 2):
        if n <= 0: break
        q = Point(RNG.uniform(bx[0], bx[2]), RNG.uniform(bx[1], bx[3]))
        if gp.contains(q) and not occ_p.contains(q):
            r_ = RNG.random(); put("tree" if r_ < 0.55 else ("tree_small" if r_ < 0.85 else "palm"), q.x, q.y, s=RNG.uniform(0.7, 1.3), v=RNG.randrange(4)); n -= 1
# court parking: rows of bays in the paved court, cars in ~75 % of bays
if parking is not None and not parking.is_empty:
    pk = parking.buffer(-1.0)
    for row_y in np.arange(-3.0, 82.0, 6.0):
        for x in np.arange(-52.0, 12.0, 2.6):
            q = sbox(x, row_y, x + 2.5, row_y + 5.0)
            if pk.contains(q) and RNG.random() < 0.75:
                put("car", x + 1.25, row_y + 2.5, rot=math.pi / 2 + (math.pi if RNG.random() < 0.5 else 0) + RNG.uniform(-0.04, 0.04), v=RNG.randrange(8))
# a few parked cars along residential streets and moving traffic on majors
for c, ls in road_lines.items():
    for l in ls:
        for g in getattr(l["g"], "geoms", [l["g"]]):
            if g.length < 20: continue
            if c == "primary":
                for s in np.arange(10, g.length - 10, 38.0):
                    a = g.interpolate(s); b = g.interpolate(s + 1); ang = math.atan2(b.y - a.y, b.x - a.x)
                    lane = RNG.choice([-3.1, 0.0, 3.1]); nx, ny = -math.sin(ang), math.cos(ang)
                    kind = "bus" if RNG.random() < 0.22 else "car"
                    put(kind, a.x + nx * lane, a.y + ny * lane, rot=ang, v=RNG.randrange(8) if kind == "car" else RNG.randrange(3))
            elif c in ("secondary", "tertiary"):
                for s in np.arange(8, g.length - 8, 55.0):
                    a = g.interpolate(s); b = g.interpolate(s + 1); ang = math.atan2(b.y - a.y, b.x - a.x); side = RNG.choice([-1, 1])
                    nx, ny = -math.sin(ang), math.cos(ang); off = side * WID[c] / 4
                    put("bus" if RNG.random() < 0.1 else "car", a.x + nx * off, a.y + ny * off, rot=ang + (math.pi if side < 0 else 0), v=RNG.randrange(8))
            elif c in ("residential", "living_street"):
                for s in np.arange(6, g.length - 6, 23.0):
                    if RNG.random() > 0.35: continue
                    a = g.interpolate(s); b = g.interpolate(s + 1); ang = math.atan2(b.y - a.y, b.x - a.x); nx, ny = -math.sin(ang), math.cos(ang)
                    off = (WID[c] / 2 - 0.9) * RNG.choice([-1, 1]); q = Point(a.x + nx * off, a.y + ny * off)
                    if not bld_union.buffer(0.5).contains(q): put("car", q.x, q.y, rot=ang, v=RNG.randrange(8))
# campus lamps around the court
if court is not None:
    for p in resample(court.buffer(-1.0).exterior, 18.0)[:-1]: put("lamp", p.x, p.y)
# pylons: two lines leaving the substation (west and south-west), plus a line crossing north
pylon_lines = []
if sub is not None:
    c = sub.centroid
    for ang in (math.radians(170), math.radians(215), math.radians(120)):
        pts = [(c.x + math.cos(ang) * d, c.y + math.sin(ang) * d) for d in np.arange(70, 1400, 260)]
        pts = [q for q in pts if math.hypot(*q) < 1500]
        if len(pts) >= 2: pylon_lines.append(pts)
        for i, q in enumerate(pts): put("pylon", q[0], q[1], rot=ang + math.pi / 2, s=1.0)
# railway catenary masts
for l in rails:
    g = l.intersection(DISC.buffer(-5))
    for gg in getattr(g, "geoms", [g]):
        if gg.length < 10: continue
        for p in resample(gg, 55.0):
            b = gg.interpolate(min(gg.length, gg.project(p) + 1)); ang = math.atan2(b.y - p.y, b.x - p.x)
            put("rail_mast", p.x - math.sin(ang) * 4.5, p.y + math.cos(ang) * 4.5, rot=ang)
rail_lines = [[[round(x, 2), round(y, 2)] for x, y in gg.coords] for l in rails for gg in getattr(l.intersection(DISC.buffer(-3)), "geoms", [l.intersection(DISC.buffer(-3))]) if not gg.is_empty and gg.length > 10]
print({k: len(v) for k, v in props.items()})
assume("props", "Trees are scattered by land use (no OSM tree data here), avenue trees every 14 m on major footpaths, palms on the court, the median and the "
       "RTP frontage. Moving traffic on Thane-Belapur Road (1 vehicle per 38 m per carriageway, 22 % buses), parked cars in 75 % of the court bays.")

# ------------------------------------------------------------------ 6. Sun positions (NOAA), 19 Nov 2026, IST
def sun(y, mo, d, hh, mm, lat=LAT0, lon=LON0, tz=5.5):
    import datetime
    t = datetime.datetime(y, mo, d, hh, mm) - datetime.timedelta(hours=tz)
    jd = (t - datetime.datetime(2000, 1, 1, 12)).total_seconds() / 86400 + 2451545.0; T = (jd - 2451545.0) / 36525
    L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360; Mm = 357.52911 + T * (35999.05029 - 0.0001537 * T)
    e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T)
    C = math.sin(math.radians(Mm)) * (1.914602 - T * (0.004817 + 0.000014 * T)) + math.sin(math.radians(2 * Mm)) * (0.019993 - 0.000101 * T) + math.sin(math.radians(3 * Mm)) * 0.000289
    tl = L0 + C; om = 125.04 - 1934.136 * T; lam = tl - 0.00569 - 0.00478 * math.sin(math.radians(om))
    eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * math.cos(math.radians(om))
    decl = math.degrees(math.asin(math.sin(math.radians(eps)) * math.sin(math.radians(lam))))
    yv = math.tan(math.radians(eps / 2)) ** 2
    eqt = 4 * math.degrees(yv * math.sin(2 * math.radians(L0)) - 2 * e * math.sin(math.radians(Mm)) + 4 * e * yv * math.sin(math.radians(Mm)) * math.cos(2 * math.radians(L0))
                           - 0.5 * yv * yv * math.sin(4 * math.radians(L0)) - 1.25 * e * e * math.sin(2 * math.radians(Mm)))
    tst = (t.hour * 60 + t.minute + eqt + 4 * lon) % 1440; ha = tst / 4 - 180
    zen = math.degrees(math.acos(math.sin(math.radians(lat)) * math.sin(math.radians(decl)) + math.cos(math.radians(lat)) * math.cos(math.radians(decl)) * math.cos(math.radians(ha))))
    az = (math.degrees(math.atan2(math.sin(math.radians(ha)), math.cos(math.radians(ha)) * math.sin(math.radians(lat)) - math.tan(math.radians(decl)) * math.cos(math.radians(lat)))) + 180) % 360
    el = 90 - zen
    # refraction (approx)
    if el > -0.575: el += (1.02 / math.tan(math.radians(el + 10.3 / (el + 5.11)))) / 60
    v = [math.sin(math.radians(az)) * math.cos(math.radians(el)), math.cos(math.radians(az)) * math.cos(math.radians(el)), math.sin(math.radians(el))]
    return {"azimuth_deg": round(az, 2), "elevation_deg": round(el, 2), "dir_to_sun_rtp_local": [round(c, 5) for c in v]}
STATES = {"morning": ("09:30", sun(2026, 11, 19, 9, 30)), "midday": ("13:00", sun(2026, 11, 19, 13, 0)), "golden": ("17:45", sun(2026, 11, 19, 17, 45)),
          "blue_hour": ("18:15", sun(2026, 11, 19, 18, 15)), "night": ("20:30", sun(2026, 11, 19, 20, 30))}
assume("sun", "Sun positions computed (NOAA algorithm) for 19 Nov 2026 IST at 19.1692 N 73.0018 E. Sunset that day is ~18:00 IST, so the plan's 18:45 blue hour "
       "is taken at 18:15 and night at 20:30. " + "; ".join(f"{k} {t}: az {s['azimuth_deg']}, el {s['elevation_deg']}" for k, (t, s) in STATES.items()))

prep = {"frame": "rtp_local: x east, y north, metres from the Maps pin 19.1692159 N 73.0017703 E; z up from site ground",
        "rtp": rtp, "buildings": bld_out, "ground": ground_parts, "roads": {"road": road_tri, "median": median_tri, "footpath": foot_tri, "rail_bed": rail_tri,
        "kerb_rings": kerb_rings, "marks": marks, "marks_tri": marks_tri, "rail_lines": rail_lines}, "props": props, "pylon_lines": pylon_lines,
        "substation": ring_list(sub, 2) if sub is not None else None, "pond": ring_list(pond, 2) if pond is not None else None,
        "disc_r": DISC_R, "site_ground_m": site_ground, "states": {k: {"time": t, **s} for k, (t, s) in STATES.items()}, "date": "2026-11-19"}
json.dump(prep, open(os.path.join(OUT, "prep.json"), "w"))
json.dump(ASSUME, open(os.path.join(OUT, "assumptions.json"), "w"), indent=1)
print("wrote", os.path.join(OUT, "prep.json"), round(os.path.getsize(os.path.join(OUT, "prep.json")) / 1e6, 1), "MB")

# ------------------------------------------------------------------ 7. plan plot for review
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.path import Path as MPath
from matplotlib.patches import PathPatch
def pfill(a, g, color):
    for p in polys_of(g):
        rings = [np.asarray(p.exterior.coords)] + [np.asarray(r.coords) for r in p.interiors]
        verts = np.vstack(rings); codes = np.concatenate([[MPath.MOVETO] + [MPath.LINETO] * (len(r) - 2) + [MPath.CLOSEPOLY] for r in rings])
        a.add_patch(PathPatch(MPath(verts, codes), fc=color, lw=0))
fig, axs = plt.subplots(1, 2, figsize=(26, 13))
cmap = {"ground_base": "#cdbf9a", "ground_dirt": "#b9a07a", "ground_industrial": "#a9a49a", "ground_paved": "#bdbab3", "ground_compound": "#c8c2b4", "ground_lawn": "#7aa35a",
        "ground_court_paving": "#9b9894", "water": "#4a7a8c", "ground_mud": "#7d6a50", "ground_gravel": "#a6a39c", "ground_forest": "#5f8a48", "ground_scrub": "#8fa063",
        "ground_crop": "#b8b070", "ground_construction": "#b08a60"}
for a, lim in zip(axs, (DISC_R, 160)):
    for pa in parts:
        pfill(a, pa["g"], cmap.get(pa["mat"], "#ccc"))
    pfill(a, roads_all, "#444"); pfill(a, footpath, "#999"); pfill(a, median, "#5a7"); pfill(a, rail_bed, "#765")
    for o in bld_out:
        r = o["ring"][0]; a.fill(*zip(*r), color="#d33" if o["cls"] == "B" else "#777", lw=0.2, ec="k")
    a.fill(*P_SLAB.exterior.xy, color="#36c"); a.plot(*P_GLZ.exterior.xy, "c-", lw=0.6); a.plot(*rtp_ov[1].exterior.xy, "y--", lw=0.8)
    for k, c in (("palm", "g."), ("tree", "g."), ("car", "r."), ("bus", "b."), ("lamp", "y."), ("pylon", "k^")):
        if props[k]: xs, ys = zip(*[(q[0], q[1]) for q in props[k]]); a.plot(xs, ys, c, ms=2 if lim > 200 else 4)
    a.set_xlim(-lim, lim); a.set_ylim(-lim, lim); a.set_aspect("equal")
for o in bld_out:
    if o["cls"] == "B":
        r = o["ring"][0]; xs, ys = zip(*r); axs[0].text(sum(xs) / len(xs), sum(ys) / len(ys), o["label"][:22] + f" {o['h']}", fontsize=7)
fig.savefig(os.path.join(OUT, "prep_plan.png"), dpi=55, bbox_inches="tight")
print("done")
