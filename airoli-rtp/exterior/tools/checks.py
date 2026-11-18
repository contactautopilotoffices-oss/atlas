"""Exterior checks -> airoli-rtp/exterior/checks.json + review/checks_sheet.png + review/photo_match.png
usage: venv/bin/python -I checks.py   (after checks_dump.py and the stills)"""
import json, os, math, glob
import numpy as np
import shapely
from shapely.geometry import Polygon, LineString, Point, MultiLineString
from shapely.strtree import STRtree
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt; import matplotlib.image as mpimg

EXT = "/Users/lohit/Downloads/Atlas/airoli-rtp/exterior"; B = EXT + "/_build"; REV = EXT + "/review"; os.makedirs(REV, exist_ok=True)
P = json.load(open(B + "/prep/prep.json")); D = np.load(B + "/checks/dump.npz"); J = json.load(open(B + "/checks/dump.json"))
C = {"generated": "checks.py", "checks": {}}

# ---------------------------------------------------------------- 1. footprints
R = P["rtp"]; res = {"rtp_floors": {}, "context": {}}
for f in R["floors"]:
    e = J["slab_edges"].get(f["name"])
    if not e: continue
    built = MultiLineString([tuple(map(tuple, s)) for s in e]); inp = Polygon(f["slab"][0]).exterior
    res["rtp_floors"][f["name"]] = {"hausdorff_m": round(built.hausdorff_distance(inp), 3)}
rmax = max(v["hausdorff_m"] for v in res["rtp_floors"].values())
cad = Polygon(R["slab_outline"][0]); ov = Polygon(R["overture_ring"][0])
res["rtp_vs_overture"] = {"hausdorff_m": round(cad.exterior.hausdorff_distance(ov.exterior), 2), "iou": round(cad.intersection(ov).area / cad.union(ov).area, 3),
                          "note": "informational: the CAD outline (true geometry) against the coarser OSM/Overture footprint traced from imagery"}
rings = [Polygon(b["ring"][0]).exterior for b in P["buildings"]]; tree = STRtree(rings)
pts = D["base"]; dmax = 0; over = 0; dl = []
if len(pts):
    gp = [Point(p) for p in pts]; idx = tree.query_nearest(gp, return_distance=True)
    dl = idx[1]; dmax = float(dl.max()); over = int((dl > 1.0).sum())
res["context"] = {"base_vertices": int(len(pts)), "max_dev_m": round(dmax, 3), "p99_dev_m": round(float(np.percentile(dl, 99)), 3) if len(dl) else 0, "vertices_over_1m": over,
                  "buildings_in": len(P["buildings"])}
ok1 = rmax <= 1.0 and over == 0
C["checks"]["footprints_within_1m"] = {"pass": ok1, "rtp_max_hausdorff_m": rmax, **res}
if not ok1 and over:
    C["checks"]["footprints_within_1m"]["note"] = ("context vertices beyond 1 m come from gabled roofs built on the minimum rotated rectangle of near-rectangular "
                                                   "footprints (area ratio > 0.92)")

# ---------------------------------------------------------------- 2. coplanar overlapping faces (< 2 mm apart)
T = D["tris"]; TO = D["tobj"]; names = J["names"]
v0, v1, v2 = T[:, 0], T[:, 1], T[:, 2]; n = np.cross(v1 - v0, v2 - v0); A2 = np.linalg.norm(n, axis=1); keep = A2 > 1e-6
T, TO, n, A2 = T[keep], TO[keep], n[keep], A2[keep]; n = n / A2[:, None]
# canonical normal sign
s = np.sign(np.where(np.abs(n[:, 2]) > 1e-6, n[:, 2], np.where(np.abs(n[:, 1]) > 1e-6, n[:, 1], n[:, 0]))); n = n * s[:, None]
d = np.einsum("ij,ij->i", n, T[:, 0])
qn = np.round(n * 200).astype(np.int64); qd = np.floor(d / 0.002).astype(np.int64)
from collections import defaultdict
buckets = defaultdict(list)
for i in range(len(T)): buckets[(qn[i, 0], qn[i, 1], qn[i, 2], qd[i])].append(i)
flag = []; back2back = []; tested = 0
keys = list(buckets.keys()); kset = set(keys)
def basis(nv):
    a = np.array([1.0, 0, 0]) if abs(nv[0]) < 0.9 else np.array([0, 1.0, 0]); u = np.cross(nv, a); u /= np.linalg.norm(u); v = np.cross(nv, u); return u, v
done = set()
for k in keys:
    grp = list(buckets[k])
    for dd in (1,):
        k2 = (k[0], k[1], k[2], k[3] + dd)
        if k2 in kset: grp = grp + buckets[k2]
    if len(grp) < 2: continue
    u, v = basis(n[grp[0]])
    polys = [Polygon([(p @ u, p @ v) for p in T[i]]) for i in grp]
    st = STRtree(polys); pairs = st.query(polys, predicate="intersects")
    for a, b in zip(*pairs):
        if a >= b: continue
        ia, ib = grp[a], grp[b]
        cb = T[ib].mean(0); ca = T[ia].mean(0)
        if abs(float(n[ia] @ (cb - T[ia][0]))) > 0.002 or abs(float(n[ib] @ (ca - T[ib][0]))) > 0.002: continue       # true local separation
        tested += 1
        try: ar = polys[a].intersection(polys[b]).area
        except Exception: continue
        if ar > 2e-4:
            if s[ia] == s[ib]: flag.append((names[TO[ia]], names[TO[ib]], round(float(ar), 4), [round(float(x), 2) for x in T[ia].mean(0)]))
            else: back2back.append((names[TO[ia]], names[TO[ib]], round(float(ar), 4)))
by_pair = defaultdict(lambda: [0, 0.0, None])
for a, b, ar, c in flag:
    k = tuple(sorted((a, b))); by_pair[k][0] += 1; by_pair[k][1] += ar; by_pair[k][2] = c
C["checks"]["no_coplanar_overlaps_2mm"] = {"pass": len(flag) == 0, "triangles": int(len(T)), "pairs_tested": tested, "overlapping_triangle_pairs": len(flag),
    "by_object_pair": [{"a": k[0], "b": k[1], "tri_pairs": v[0], "area_m2": round(v[1], 3), "example_xyz": v[2]} for k, v in sorted(by_pair.items(), key=lambda kv: -kv[1][1])[:30]],
    "back_to_back_pairs": len(back2back), "back_to_back_note": "opposite-facing coincident faces (party walls of adjacent Overture houses); both sit inside the combined volume, so they cannot flicker from outside",
    "back_to_back_examples": sorted({(a, b) for a, b, _ in back2back})[:10],
    "method": "triangles bucketed by normal (0.005) and plane offset (2 mm); same-facing in-plane overlap > 2 cm2 between any two triangles is flagged"}

# ---------------------------------------------------------------- 3. untextured / default materials
bad_default = []; empty = []; untextured_near = []; flat_ok = []
FLAT_INTENT = ("glass", "mullion", "steel", "metal", "sign_", "prop_", "road_marking", "rtp_dome", "rtp_plant", "ctx_median")
for nm, o in J["objects"].items():
    if o["empty_slot"]: empty.append(nm)
    for m in o["materials"]:
        if m.lower().startswith("material") or m.lower() == "default": bad_default.append((nm, m))
        if o.get("ctx") in ("B", "C", "ground", "road") and o["dist_m"] < 300 and not o["textured"].get(m, False) and not any(t in m for t in FLAT_INTENT):
            untextured_near.append((nm, m))
for m, k in J["materials"].items():
    if not k["image"]: flat_ok.append(m)
ok3 = not bad_default and not empty and not untextured_near
C["checks"]["no_untextured_or_default_materials"] = {"pass": ok3, "default_materials": bad_default[:20], "objects_with_empty_slots": empty[:20],
    "untextured_buildings_or_ground_within_300m": untextured_near[:20],
    "untextured_by_design": sorted(flat_ok), "note": "materials without an image are glass, metals, paint (cars), emissive signs and the white dome: deliberate PBR, not default grey"}

# ---------------------------------------------------------------- 4. stills exposure
stl = json.load(open(EXT + "/stills/stills_log.json")) if os.path.exists(EXT + "/stills/stills_log.json") else {}
st_res = {}; ok4 = bool(stl)
for k, v in stl.items():
    good = v["blown_frac"] <= 0.01 and v["crushed_frac"] <= (0.25 if k.startswith("night") else 0.05)
    st_res[k] = {"blown_frac": v["blown_frac"], "crushed_frac": v["crushed_frac"], "median": v.get("median"), "pass": good, "seconds": v["seconds"]}
    ok4 = ok4 and good
C["checks"]["stills_blown_crushed"] = {"pass": ok4, "rule": "blown = luminance >= 0.98, crushed <= 0.03; pass if blown <= 1 % and crushed <= 5 % (25 % for night)", "stills": st_res}

# ---------------------------------------------------------------- 5. photo-match sheet
REF = [("Blue-green reflective curtain wall in continuous horizontal ribbons, one per floor", None),
       ("Silver-grey ACP band at every slab edge (0.6-0.9 m)", "built: 0.85 m satin ACP band, 50 mm proud"),
       ("Rounded ends stacked as terraces stepping back near the top", "built: L08 / L09 step back 3.5 / 7 m at both rounded ends"),
       ("Central grey vertical spine with ribbed elements on the long facade", "built: grey piers every 1.2 m on the court-side bulge of the east arm"),
       ("Large round drums on the roof at the rounded ends, one with a white dome", "built: two 13 m drums, white dome on the south drum"),
       ("Red illuminated RELIABLE sign with a white R logo on a rooftop drum", "built: on the west drum, facing south-south-west"),
       ("Chamfered inner corner (main lobby) facing a SW court with palms and parking", "built: double-height glass lobby on a 45-degree face, palms, 2.5 x 5 m bays"),
       ("Night: pink / violet uplighting, office floors glow, red sign", "built in the night state: alternating pink / violet spots every 9 m")]
court = next((EXT + "/stills/" + os.path.basename(v["file"]) for k, v in stl.items() if k.endswith("_court") and k.startswith("morning")), None)
fig = plt.figure(figsize=(22, 10)); ax = fig.add_axes([0.01, 0.05, 0.58, 0.9])
if court and os.path.exists(court): ax.imshow(mpimg.imread(court)); ax.set_title("Render: court view toward the chamfered lobby, 09:30", fontsize=12)
ax.axis("off"); tx = fig.add_axes([0.61, 0.05, 0.38, 0.9]); tx.axis("off")
lines = ["REFERENCE LOOK (public photos 2016-2022, described; no photo is reproduced)", ""]
for i, (r, b) in enumerate(REF):
    lines += [f"{i + 1}. {r}", f"    {b or 'built: STRUCTURAL GLAZING ribbons from the CAD, 1.37 m mullion module, tinted reflective glass'}", ""]
lines += ["DOES NOT MATCH / NOT VERIFIED", "- Floor count G + 9 is not confirmed (no section drawing).", "- Drum, dome and sign positions read from photos, not drawings.",
          "- Spine position is an assumption; ribs are evenly spaced, not surveyed.", "- No camera-matched photo overlay: the reference photos are not in the repo,",
          "  so proportion and band count were not overlaid (plan E2 gate still open).", "- Neighbour facades are typed (glass / punched / cladding), not surveyed."]
tx.text(0, 1, "\n".join(lines), va="top", fontsize=11, family="monospace")
fig.savefig(REV + "/photo_match.png", dpi=70); plt.close(fig)
C["checks"]["photo_match_sheet"] = {"pass": None, "file": "review/photo_match.png", "matches": [r for r, _ in REF],
                                    "does_not_match": ["no overlay against a real photo (none in the repo)", "floor count unconfirmed", "roof element positions from photos"]}

# ---------------------------------------------------------------- sheet
json.dump(C, open(EXT + "/checks.json", "w"), indent=1)
fig = plt.figure(figsize=(20, 12)); ax = fig.add_axes([0.01, 0.52, 0.48, 0.46]); ax.axis("off")
rows = [(k, "PASS" if v["pass"] else ("n/a" if v["pass"] is None else "FAIL")) for k, v in C["checks"].items()]
txt = "\n".join(f"{k:40s} {s}" for k, s in rows)
txt += f"\n\nRTP floor slabs vs CAD: max {rmax} m\nRTP CAD vs Overture: Hausdorff {res['rtp_vs_overture']['hausdorff_m']} m, IoU {res['rtp_vs_overture']['iou']}"
txt += f"\ncontext base vertices: max dev {res['context']['max_dev_m']} m, {res['context']['vertices_over_1m']} over 1 m"
txt += f"\ncoplanar overlapping pairs: {len(flag)} (of {tested} tested)"
txt += "\n" + "\n".join(f"  {p['a'][:28]} x {p['b'][:28]}: {p['tri_pairs']}" for p in C["checks"]["no_coplanar_overlaps_2mm"]["by_object_pair"][:6])
txt += "\n\nstills:\n" + "\n".join(f"  {k:16s} blown {v['blown_frac']:.3f} crushed {v['crushed_frac']:.3f} {'ok' if v['pass'] else 'FAIL'}" for k, v in st_res.items())
ax.text(0, 1, txt, va="top", family="monospace", fontsize=11)
ims = sorted(glob.glob(EXT + "/stills/rtp_*.png"))[:6]
for i, f in enumerate(ims):
    a = fig.add_axes([0.5 + (i % 3) * 0.166, 0.52 - (i // 3) * 0.26 + 0.2, 0.16, 0.24]); a.imshow(mpimg.imread(f)); a.set_title(os.path.basename(f), fontsize=8); a.axis("off")
a = fig.add_axes([0.01, 0.02, 0.48, 0.46]); a.set_aspect("equal")
for b in P["buildings"]:
    r = np.array(b["ring"][0]); a.fill(r[:, 0], r[:, 1], color="#c33" if b["cls"] == "B" else "#999", lw=0)
a.fill(*cad.exterior.xy, color="#36c"); a.plot(*ov.exterior.xy, "y-", lw=1); a.set_xlim(-300, 300); a.set_ylim(-250, 350); a.set_title("footprints: RTP CAD (blue), Overture RTP (yellow), Class B (red)")
if len(dl) and over and len(dl) == len(pts):
    bad = pts[np.asarray(dl) > 1.0]; a.plot(bad[:, 0], bad[:, 1], "k.", ms=2)
fig.savefig(REV + "/checks_sheet.png", dpi=60); plt.close(fig)
print(json.dumps({k: v["pass"] for k, v in C["checks"].items()}))

# ---------------------------------------------------------------- time-of-day sheet (states x cameras)
sts = ["morning", "golden", "night"]; cms = ["court", "road", "orbit"]
fig, axs = plt.subplots(3, 3, figsize=(24, 13.5))
for i, st in enumerate(sts):
    for j, cm in enumerate(cms):
        f = EXT + f"/stills/rtp_{st}_{cm}.png"; a = axs[i, j]; a.axis("off")
        if os.path.exists(f): a.imshow(mpimg.imread(f)); a.set_title(f"{st} / {cm}", fontsize=12)
fig.tight_layout(); fig.savefig(REV + "/time_of_day_sheet.png", dpi=50); plt.close(fig)
