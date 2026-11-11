"""Make Volt's CAD floor sit inside the Skymark twin, and fill the gap where the
twin is too small.

fit_twin.py fits the CAD outline to the real footprint (Overture). The CAD and
the footprint agree that the first floor runs the full width to the street
front. The twin (built from photos) puts its main facade about 8 m further back
and has only a 12.4 m wide two-storey block (the "annex") in front. So Volt's
front rooms stuck out of the twin by up to 1.6 m beyond the annex and across the
whole width.

This script:
1. Slides the CAD back along the building's long axis until Volt's front wall
   lines up with the twin's front (the annex face, where the entrance porch is).
   The slide is recorded, and the overlap with the real footprint is reported.
2. Works out the part of the CAD's first-floor outline that the twin does not
   cover (in front of the main facade, beside the annex) and stores it as
   "podium": the viewer builds a two-storey glass block there, matching the
   annex, so the building is closed and nothing floats outside it.

Twin measurements (glTF frame of fm_skymark_atlas.glb, metres, x across the
front, z towards the street), read from the model's own parts:
  main front facade (SKY_FrontA_CurtainWall_Glass)  z = 21.5
  annex (SKY_Annex_Body)                            x 2.7 to 15.1, z 21.5 to 29.5, 9.7 m high

Usage: python3 fit_to_twin.py <volt-floor1.layout.json> <context_overture.json>
"""
import json, math, sys
from shapely.geometry import Polygon, box, MultiPolygon
from shapely.ops import unary_union

lay_p, ctx_p = sys.argv[1:3]
L = json.load(open(lay_p)); SF = L["site_fit"]
FRONT_Z, ANNEX = 21.5, (2.7, 21.5, 15.1, 29.5)
ANNEX_FRONT = ANNEX[3]
if "dx_fit" not in SF: SF["dx_fit"], SF["dy_fit"] = SF["dx"], SF["dy"]
rho, phi = math.radians(SF["rot_deg"]), math.radians(SF["twin_phi_deg"])
Pc, Fc, C = SF["plate_centroid"], SF["footprint_centroid"], SF["twin_C"]
rear = (math.sin(math.radians(326)), math.cos(math.radians(326)))     # towards the back of the building (front faces 146 deg)

def to_twin(p, dx, dy):
    x, y = p[0] - Pc[0], p[1] - Pc[1]
    ex = math.cos(rho) * x - math.sin(rho) * y + Fc[0] + dx - C[0]
    ey = math.sin(rho) * x + math.cos(rho) * y + Fc[1] + dy - C[1]
    bx = math.cos(-phi) * ex - math.sin(-phi) * ey; by = math.sin(-phi) * ex + math.cos(-phi) * ey
    return (bx, -by)
def from_twin(q, dx, dy):
    bx, by = q[0], -q[1]
    ex = math.cos(phi) * bx - math.sin(phi) * by + C[0] - Fc[0] - dx; ey = math.sin(phi) * bx + math.cos(phi) * by + C[1] - Fc[1] - dy
    return (math.cos(-rho) * ex - math.sin(-rho) * ey + Pc[0], math.sin(-rho) * ex + math.cos(-rho) * ey + Pc[1])

volt0 = Polygon([to_twin(p, SF["dx_fit"], SF["dy_fit"]) for p in L["floor"][0]["outer"]])
shift = max(0.0, volt0.bounds[3] - (ANNEX_FRONT - 0.1))                 # metres to slide back
dx, dy = SF["dx_fit"] + shift * rear[0], SF["dy_fit"] + shift * rear[1]
SF.update({"dx": round(dx, 3), "dy": round(dy, 3), "front_shift_m": round(shift, 2),
           "front_shift_why": "Slid back along the long axis so Volt's front wall meets the twin's front (the annex face with the entrance porch). The real footprint and the CAD put the front about 1.6 m further out than the twin does."})

plate = Polygon([to_twin(p, dx, dy) for p in L["plate"]]).buffer(0)
body = box(-16.3, -29.5, 16.75, FRONT_Z); annex = box(*ANNEX)
gap = plate.difference(body.union(annex)).buffer(-0.05).buffer(0.05)
parts = [g for g in (gap.geoms if isinstance(gap, MultiPolygon) else [gap]) if g.area > 2.0]
L["podium"] = [[[round(v, 3) for v in from_twin(c, dx, dy)] for c in list(g.exterior.coords)[:-1]] for g in parts]
# facade edges of the podium: only the ones that face outwards (not the ones against the twin's body or annex)
shell = body.union(annex).buffer(0.08); edges = []
for g in parts:
    cs = list(g.exterior.coords)
    for (ax, az), (bx, bz) in zip(cs, cs[1:]):
        ln = math.hypot(bx - ax, bz - az)
        if ln < 0.3: continue
        mx, mz, nx, nz = (ax + bx) / 2, (az + bz) / 2, -(bz - az) / ln, (bx - ax) / ln
        from shapely.geometry import Point
        out = (mx + nx * 0.3, mz + nz * 0.3) if not g.contains(Point(mx + nx * 0.3, mz + nz * 0.3)) else (mx - nx * 0.3, mz - nz * 0.3)
        if shell.contains(Point(out)): continue
        p0, p1 = from_twin((ax, az), dx, dy), from_twin((bx, bz), dx, dy)
        edges.append([round(p0[0], 3), round(p0[1], 3), round(p1[0], 3), round(p1[1], 3)])
L["podium_edges"] = edges
L["podium_about"] = "Two-storey glass block (ground and first floor, 9.7 m like the annex) where the CAD's first floor runs beyond the twin. Plan coordinates."

C_ = json.load(open(ctx_p)); fp = Polygon([b["ring"] for b in C_["buildings"] if b["id"].startswith("22e4bdbe")][0])
def plate_enu(dx_, dy_):
    out = []
    for p in L["plate"]:
        x, y = p[0] - Pc[0], p[1] - Pc[1]
        out.append((math.cos(rho) * x - math.sin(rho) * y + Fc[0] + dx_, math.sin(rho) * x + math.cos(rho) * y + Fc[1] + dy_))
    return Polygon(out)
iou = lambda g: g.intersection(fp).area / g.union(fp).area
SF["iou_after_shift"] = round(iou(plate_enu(dx, dy)), 3)
json.dump(L, open(lay_p, "w"), separators=(",", ":"))
volt1 = Polygon([to_twin(p, dx, dy) for p in L["floor"][0]["outer"]])
print(f"shift {shift:.2f} m; IoU with footprint {SF['iou']} -> {SF['iou_after_shift']}; Volt outside twin+annex now {volt1.difference(body.union(annex)).area:.0f} m2; podium parts {[round(g.area) for g in parts]} m2")
