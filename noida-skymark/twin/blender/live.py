"""Tiny client for the blender-mcp add-on running inside the user's open Blender (socket on localhost:9876).

Protocol (from the add-on's mcp_to_blender_server.py): one request per connection, a JSON object followed by a NUL
byte: {"type": "execute", "code": "<python>", "strict_json": true}. The code runs in Blender's main thread and must
put a JSON-able dict in a variable named `result`; the reply is {"status": "ok", "result": {...}, "stdout": "..."}
followed by a NUL byte.

  python3 live.py info                               # file name, unsaved changes, object count
  python3 live.py run script.py                      # run a file inside the live session
  python3 live.py open FILE.blend [--force]          # open a built .blend (refuses if the live file has unsaved work)
  python3 live.py shot OUT.png [--camera NAME] [--shading MATERIAL|RENDERED|SOLID] [--wait 6] [--view top|camera]
                                                     # viewport screenshot (3D view only) to a PNG
Heavy work (bake, stills, export) stays in headless `Blender -b` runs; this is for looking.
"""
import json, socket, sys, time, os

HOST, PORT = "127.0.0.1", 9876

def call(code, timeout=120):
    s = socket.create_connection((HOST, PORT), timeout=timeout)
    s.sendall((json.dumps({"type": "execute", "code": code, "strict_json": True}) + "\0").encode())
    buf = b""
    while not buf.endswith(b"\0"):
        c = s.recv(1 << 16)
        if not c: break
        buf += c
    s.close()
    r = json.loads(buf.rstrip(b"\0").decode())
    if r.get("status") != "ok": raise RuntimeError(r.get("message", r))
    return r.get("result", {})

def info():
    return call("import bpy\nresult={'file': bpy.data.filepath, 'dirty': bpy.data.is_dirty, 'objects': len(bpy.data.objects), 'version': bpy.app.version_string}")

def open_blend(path, force=False):
    i = info()
    safe = (not i["dirty"]) or force or "/twin/_build/" in i["file"]
    if not safe: raise SystemExit(f"live Blender has unsaved changes in {i['file'] or 'an untitled file'}; not opening (use --force only if the user agrees)")
    return call(f"import bpy\nbpy.ops.wm.open_mainfile(filepath={os.path.abspath(path)!r}, load_ui=False)\nresult={{'file': bpy.data.filepath, 'objects': len(bpy.data.objects)}}", 300)

SHOT = r'''
import bpy, math
from mathutils import Vector
win = bpy.context.window_manager.windows[0]; scr = win.screen
area = max((a for a in scr.areas if a.type == "VIEW_3D"), key=lambda a: a.width * a.height)
space = area.spaces.active; region = next(r for r in area.regions if r.type == "WINDOW"); r3d = space.region_3d
space.shading.type = __SHADING__; space.overlay.show_overlays = False
for o in bpy.context.scene.objects:
    if o.name.endswith("_COLLISION") or o.get("collision"): o.hide_viewport = True
if __CAMERA__:
    cam = bpy.data.objects[__CAMERA__]; bpy.context.scene.camera = cam; r3d.view_perspective = "CAMERA"; space.lock_camera = False
    with bpy.context.temp_override(window=win, area=area, region=region): bpy.ops.view3d.view_center_camera()   # camera frame fills the view
elif __VIEW__ == "top":
    r3d.view_perspective = "ORTHO"; r3d.view_rotation = (1, 0, 0, 0)
    with bpy.context.temp_override(window=win, area=area, region=region): bpy.ops.view3d.view_all(center=False)
result = {"area": [area.width, area.height]}
'''
GRAB = r'''
import bpy
win = bpy.context.window_manager.windows[0]; area = max((a for a in win.screen.areas if a.type == "VIEW_3D"), key=lambda a: a.width * a.height)
region = next(r for r in area.regions if r.type == "WINDOW")
with bpy.context.temp_override(window=win, area=area, region=region): bpy.ops.screen.screenshot_area(filepath=__OUT__)
area.spaces.active.shading.type = "SOLID"      # stop the live render so it does not compete with headless Cycles runs
result = {"saved": __OUT__}
'''

def shot(out, camera=None, shading="MATERIAL", wait=6.0, view=None):
    call(SHOT.replace("__SHADING__", repr(shading)).replace("__CAMERA__", repr(camera)).replace("__VIEW__", repr(view)))
    time.sleep(wait)          # rendered / material preview needs a moment to converge
    return call(GRAB.replace("__OUT__", repr(os.path.abspath(out))))

if __name__ == "__main__":
    a = sys.argv[1:]
    def opt(k, d=None):
        return a[a.index(k) + 1] if k in a else d
    if not a or a[0] == "info": print(info())
    elif a[0] == "run": print(call(open(a[1]).read(), 600))
    elif a[0] == "open": print(open_blend(a[1], "--force" in a))
    elif a[0] == "shot": print(shot(a[1], opt("--camera"), opt("--shading", "MATERIAL"), float(opt("--wait", 6)), opt("--view")))
