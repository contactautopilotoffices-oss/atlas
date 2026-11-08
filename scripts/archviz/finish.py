"""The archviz finish: take a scene our builders made and bring it to a 4K photoreal render.

  blender -b -P scripts/archviz/finish.py -- --project scripts/archviz/specs/skymark.json --shot three_quarter --preset golden --quality final --out renders/skymark-3q.png
  blender -b -P scripts/archviz/finish.py -- --project scripts/archviz/specs/skymark.json --move flydown --frames 300 --quality final --out renders/fly/skymark-
  blender -b -P scripts/archviz/finish.py -- --project ... --save finished.blend --no-render        the finished scene, to open and work on
  blender -b -P scripts/archviz/finish.py -- fetch                                                  fill assets/library from Poly Haven

What it does, in order (each step can be skipped with --no-<step>):
  load      the project's source: a .blend our builders saved, or a diorama GLB with its JSON
  city      rebuild the district round the hero from the Overture scene (facade depth near the camera)
  materials swap every builder material for a finished PBR one (texture sets, bevel, dirt, real glass)
  vegetation replace proxy trees, palms and hedges with instanced assets; scatter grass
  entourage cars along the lanes, people at the entrance and on the footpaths, lamp posts, benches
  light     HDRI or physical sky with the sun where it stands over the site on the date and hour
  camera    one shot from the shot list, or a move
  render    GPU Cycles at the quality asked, OIDN denoise, compositor finish (bloom, vignette, grain)

Presets: noon, afternoon, golden, dusk, night, overcast. Qualities: preview, final, ultra.
Shots: street, corner, three_quarter, aerial, drone, detail, interior. Moves: orbit, flydown, dolly.
Project specs live in scripts/archviz/specs/. Runs the same under `blender -b -P` and under the
bpy pip module (`bl/bin/python scripts/archviz/finish.py -- ...`).
"""
import sys, os, math, json
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import bpy
from lib.common import *
from lib import assets, materials, environment, vegetation, entourage, city, camera, render

def main():
    a = argv()
    if a and a[0] == "fetch":
        slots = arg("--slots"); assets.fetch(slots.split(",") if slots else None, arg("--res", "2k")); return
    proj = arg("--project");
    if not proj: print(__doc__); return
    spec = load_json(proj if os.path.isabs(proj) else os.path.join(REPO, proj) if not os.path.exists(proj) else proj)
    base = os.path.dirname(os.path.abspath(proj if os.path.exists(proj) else os.path.join(REPO, proj)))
    rel = lambda p: p if (not p or os.path.isabs(p)) else (p if os.path.exists(p) else os.path.join(REPO, p) if os.path.exists(os.path.join(REPO, p)) else os.path.join(base, p))
    preset = arg("--preset", spec.get("preset", "afternoon")); spec["preset"] = preset
    quality = arg("--quality", "final"); res = tuple(int(v) for v in arg("--res", spec.get("res", "3840x2160")).split("x"))
    shot = arg("--shot", "three_quarter"); move = arg("--move"); frames = arg("--frames", 240, int); out = arg("--out")
    spec["wet"] = arg("--wet", spec.get("wet", 0.0), float)

    # ---- load
    src = spec["source"]; diorama = None
    if src["kind"] == "blend":
        bpy.ops.wm.open_mainfile(filepath=rel(src["path"])); log("opened", src["path"])
    elif src["kind"] == "glb":
        bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=rel(src["path"])); log("imported", src["path"])
        if src.get("json"): diorama = load_json(rel(src["json"]))
        for o in list(bpy.data.objects):   # the page instances these itself; here they would render at the origin
            if o.name.startswith("proto_"): bpy.data.objects.remove(o)
    else:
        raise SystemExit("source.kind must be blend or glb")
    if diorama and "front_deg" not in spec.get("hero", {}):
        f = diorama["building"]["foot"]; cx = sum(p[0] for p in f) / len(f); cy = sum(p[1] for p in f) / len(f); sx, sy = diorama["street_cam"]
        spec.setdefault("hero", {})["front_deg"] = math.degrees(math.atan2(sy - cy, sx - cx))
    for o in list(bpy.data.objects):   # the builders' own camera and lights go; the finish brings its own
        if o.type in ("CAMERA", "LIGHT"): bpy.data.objects.remove(o)

    # ---- the upgrades
    if not flag("--no-city") and spec.get("city", {}).get("scene_json"):
        p = rel(spec["city"]["scene_json"])
        if os.path.exists(p):
            lo, hi = camera._hero_bbox(spec); city.build(spec, p, focus=((lo.x + hi.x) / 2, (lo.y + hi.y) / 2))
        else: log("city: scene.json not found, keeping the builder's context:", p)
    if not flag("--no-materials"): materials.upgrade(spec)
    if not flag("--no-vegetation"): vegetation.replace(spec, diorama)
    if not flag("--no-entourage"): entourage.populate(spec, diorama)
    P = environment.apply(spec, preset)
    if P.get("lights"): environment.lights_on(True)
    if move: camera.animate(spec, move, frames, res)
    else: camera.shot(spec, shot, res)
    render.configure(quality, spec); render.compositor(spec)

    if arg("--save"):
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(arg("--save"))); log("saved scene", arg("--save"))
    if flag("--no-render"): return
    if move: render.movie(out or os.path.join(REPO, "renders", spec["id"], f"{move}-"))
    else: render.still(out or os.path.join(REPO, "renders", spec["id"], f"{shot}-{preset}.png"))

main()
