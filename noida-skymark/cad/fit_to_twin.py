"""Place a tenant's floor in the Skymark building twin, on its real level.

Volt's live layout already carries the fitted placement of the first-floor plan in the twin
(site_fit: CAD plan -> map ENU; from volt/cad/fit_twin.py + fit_to_twin.py). Every other tenant is
first registered onto Volt's plan frame from the shared columns (cad/plate_fit.py: rotation theta,
shift d). The two maps compose exactly into a site_fit of the same form, so the viewer code that
reads Volt's site_fit works unchanged:

    ENU = R(rot) * (R(theta) p + d - Pc) + Fc + [dx, dy]
        = R(rot + theta) * (p - Pc') + Fc + [dx, dy],    Pc' = R(-theta) (Pc - d)

Level: storeys.volt_level / storeys.level = the floor number; the viewer raises the slab by
level x floor_to_floor. The podium (Volt's fix for the part of the first floor in front of the twin's
main facade) only exists up to the annex roof (9.7 m, ground + first). A floor above it gets no
podium; the part of its plate outside the twin is reported as twin_overhang instead.

Usage: python3 -I fit_to_twin.py --tenant <t> --floor <n> --layout <t layout> --volt <volt layout>
                                 --plate-fit <plate_fit.json> --context <context_overture.json>
"""
import argparse, json, math, os, sys
from shapely.geometry import Polygon, box, MultiPolygon, Point
from shapely.ops import unary_union

ap = argparse.ArgumentParser()
for k in ('--tenant', '--layout', '--volt', '--plate-fit', '--context'): ap.add_argument(k, required=True)
ap.add_argument('--floor', type=int, required=True)
a = ap.parse_args()
L = json.load(open(a.layout)); V = json.load(open(a.volt)); PF = json.load(open(a.plate_fit))
SFV = V['site_fit']
if a.tenant == 'volt': th, d = 0.0, (0.0, 0.0); reg = {"rot_deg": 0, "dx": 0, "dy": 0, "note": "Volt is the reference frame"}
else:
    reg = PF[a.tenant]['fit_to_volt_frame']; th, d = math.radians(reg['rot_deg']), (reg['dx'], reg['dy'])
Pc = SFV['plate_centroid']
c_, s_ = math.cos(-th), math.sin(-th); vx, vy = Pc[0] - d[0], Pc[1] - d[1]
Pc2 = [round(c_ * vx - s_ * vy, 3), round(s_ * vx + c_ * vy, 3)]
SF = {k: v for k, v in SFV.items()}
SF.update({"rot_deg": round(SFV['rot_deg'] + math.degrees(th), 3), "plate_centroid": Pc2,
           "via_volt_frame": {"registration": reg, "how": "tenant plan -> Volt plan frame from matched columns (cad/plate_fit.py), then Volt's own site_fit. Composed exactly; same formula as Volt's site_fit."}})
L['site_fit'] = SF

# ---- twin geometry (same numbers as volt/cad/fit_to_twin.py)
FRONT_Z, ANNEX = 21.5, (2.7, 21.5, 15.1, 29.5); ANNEX_TOP = 9.7
rho, phi = math.radians(SF['rot_deg']), math.radians(SF['twin_phi_deg'])
Fc, C = SF['footprint_centroid'], SF['twin_C']; dx, dy = SF['dx'], SF['dy']
def to_twin(p):
    x, y = p[0] - Pc2[0], p[1] - Pc2[1]
    ex = math.cos(rho) * x - math.sin(rho) * y + Fc[0] + dx - C[0]; ey = math.sin(rho) * x + math.cos(rho) * y + Fc[1] + dy - C[1]
    bx = math.cos(-phi) * ex - math.sin(-phi) * ey; by = math.sin(-phi) * ex + math.cos(-phi) * ey
    return (bx, -by)
def from_twin(q):
    bx, by = q[0], -q[1]
    ex = math.cos(phi) * bx - math.sin(phi) * by + C[0] - Fc[0] - dx; ey = math.sin(phi) * bx + math.cos(phi) * by + C[1] - Fc[1] - dy
    return (math.cos(-rho) * ex - math.sin(-rho) * ey + Pc2[0], math.sin(-rho) * ex + math.cos(-rho) * ey + Pc2[1])
ftf = L['storeys'].get('floor_to_floor', 4.1)
level_z = a.floor * ftf
plate = Polygon([to_twin(p) for p in L['plate']]).buffer(0)
body = box(-16.3, -29.5, 16.75, FRONT_Z); annex = box(*ANNEX)
low = level_z + ftf <= ANNEX_TOP + 0.5          # the storey sits within the annex height (ground and first floor)
covered = body.union(annex) if low else body
gap = plate.difference(covered).buffer(-0.05).buffer(0.05)
parts = [g for g in (gap.geoms if isinstance(gap, MultiPolygon) else [gap]) if g.area > 2.0]
if low:
    L['podium'] = [[[round(v, 3) for v in from_twin(c)] for c in list(g.exterior.coords)[:-1]] for g in parts]
    shell = body.union(annex).buffer(0.08); edges = []
    for g in parts:
        cs = list(g.exterior.coords)
        for (ax, az), (bx, bz) in zip(cs, cs[1:]):
            ln = math.hypot(bx - ax, bz - az)
            if ln < 0.3: continue
            mx, mz, nx, nz = (ax + bx) / 2, (az + bz) / 2, -(bz - az) / ln, (bx - ax) / ln
            out = (mx + nx * 0.3, mz + nz * 0.3) if not g.contains(Point(mx + nx * 0.3, mz + nz * 0.3)) else (mx - nx * 0.3, mz - nz * 0.3)
            if shell.contains(Point(out)): continue
            p0, p1 = from_twin((ax, az)), from_twin((bx, bz))
            edges.append([round(p0[0], 3), round(p0[1], 3), round(p1[0], 3), round(p1[1], 3)])
    L['podium_edges'] = edges
    L['podium_about'] = "Two-storey glass block (ground and first floor, 9.7 m like the annex) where the CAD floor runs beyond the twin. Plan coordinates."
    outline = unary_union([body, annex] + parts).buffer(0.35, join_style=2)
else:
    L['podium'] = []; L['podium_edges'] = []
    L['podium_about'] = f"No podium: this floor's slab is at {level_z:.1f} m, above the twin's two-storey annex (9.7 m)."
    L['twin_overhang'] = {"polygons": [[[round(v, 3) for v in from_twin(c)] for c in list(g.exterior.coords)[:-1]] for g in parts],
                          "area_m2": round(sum(g.area for g in parts), 1),
                          "about": "Parts of this floor's CAD plate outside the twin's main body at this level (plan coordinates). The photo twin's facade sits about 1.6 m behind the CAD front; Volt's first floor was slid back by front_shift_m for the same reason and this floor inherits that slide."}
    outline = body.buffer(0.35, join_style=2)
outline = max(outline.geoms, key=lambda g: g.area) if isinstance(outline, MultiPolygon) else outline
L['shell_outline'] = [[round(v, 3) for v in from_twin(c)] for c in list(outline.simplify(0.05).exterior.coords)[:-1]]
L['storeys'].update({"volt_level": a.floor, "level": a.floor, "slab_z_m": round(level_z, 2)})
# check against the real footprint (Overture), same as Volt
C_ = json.load(open(a.context)); fp = Polygon([b["ring"] for b in C_["buildings"] if b["id"].startswith("22e4bdbe")][0])
def enu(p):
    x, y = p[0] - Pc2[0], p[1] - Pc2[1]
    return (math.cos(rho) * x - math.sin(rho) * y + Fc[0] + dx, math.sin(rho) * x + math.cos(rho) * y + Fc[1] + dy)
pe = Polygon([enu(p) for p in L['plate']]).buffer(0)
SF['iou_after_shift'] = round(pe.intersection(fp).area / pe.union(fp).area, 3)
dem = Polygon([to_twin(p) for p in L['demise']['outer']]).buffer(0)
SF['demise_outside_twin_m2'] = round(dem.difference(covered).area, 1)
json.dump(L, open(a.layout, 'w'), separators=(',', ':'))
print(a.tenant, 'rot', SF['rot_deg'], 'Pc', Pc2, 'IoU', SF['iou_after_shift'], 'level z', level_z, 'podium parts', [round(g.area) for g in parts] if low else 'none (overhang %.0f m2)' % sum(g.area for g in parts), 'demise outside twin m2', SF['demise_outside_twin_m2'])
