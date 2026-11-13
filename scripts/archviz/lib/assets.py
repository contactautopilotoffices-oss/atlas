"""Assets: the manifest of HDRIs, textures, trees, people, cars and props the finish uses.

  blender -b -P scripts/archviz/finish.py -- fetch [--slots hdri,textures,models] [--res 2k|4k]

Each slot in assets/manifest.json names what the finish wants (a 4k partly-cloudy HDRI, a
concrete texture set, a ficus tree, a parked saloon, a standing person) and how to get it:

  "source": "polyhaven" + "id" or "query"   fetched from the Poly Haven public API (CC0),
                                            into assets/library/<slot>/
  "source": "local" + "path"                your own file (Quixel, Botaniq, Graswald, a
                                            BlenderKit download, a Sketchfab glb)
  "fallback": "procedural"                  what the finish does when the file is missing

`resolve(slot)` returns the local path or None. Nothing here is required: every consumer falls
back to a procedural material or a built-in proxy so the pipeline always renders, and gets
better as the library fills. The Poly Haven API is open (no key); it is blocked in the cloud
session, so run `fetch` on your own machine.
"""
import os, json, sys, urllib.request, urllib.parse
from .common import ASSETS, LIB, log

MANIFEST = os.path.join(ASSETS, "manifest.json")
API = "https://api.polyhaven.com"

def manifest():
    with open(MANIFEST) as f: return json.load(f)

def _slot_dir(slot): d = os.path.join(LIB, slot.replace(".", "_")); os.makedirs(d, exist_ok=True); return d

def resolve(slot):
    """The local file for a slot (a file path, or a folder of texture maps), or None."""
    m = manifest().get("slots", {}).get(slot)
    if not m: return None
    if m.get("source") == "local":
        p = m["path"] if os.path.isabs(m["path"]) else os.path.join(ASSETS, m["path"])
        return p if os.path.exists(p) else None
    d = _slot_dir(slot)
    if not os.path.isdir(d): return None
    files = [f for f in os.listdir(d) if not f.startswith(".")]
    if not files: return None
    if m.get("type") == "texture": return d
    for ext in (".exr", ".hdr", ".glb", ".gltf", ".blend", ".fbx", ".jpg", ".png"):
        for f in files:
            if f.lower().endswith(ext): return os.path.join(d, f)
    return os.path.join(d, files[0])

def texture_maps(folder):
    """Map kinds in a Poly Haven style texture folder: {'diff': path, 'rough': path, 'nor': path, 'disp': path}."""
    out = {}
    if not folder or not os.path.isdir(folder): return out
    for f in os.listdir(folder):
        fl = f.lower(); p = os.path.join(folder, f)
        if any(k in fl for k in ("diff", "albedo", "color", "basecolor")): out.setdefault("diff", p)
        elif "rough" in fl: out.setdefault("rough", p)
        elif "nor_gl" in fl or "normal" in fl or "nor." in fl or "_nor_" in fl: out.setdefault("nor", p)
        elif "disp" in fl or "height" in fl: out.setdefault("disp", p)
        elif "ao" in fl: out.setdefault("ao", p)
        elif "arm" in fl: out.setdefault("arm", p)
    return out

# ------------------------------------------------------------------ fetching (Poly Haven)
def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "autopilot-atlas-archviz/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r: return r.read()

def _json(url): return json.loads(_get(url).decode("utf-8"))

def _download(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0: return dest
    log("  downloading", os.path.basename(dest)); data = _get(url)
    with open(dest, "wb") as f: f.write(data)
    return dest

def _pick_asset(m):
    """The Poly Haven id for a slot: its `id` if given and it exists, else the best match for its query."""
    t = {"hdri": "hdris", "texture": "textures", "model": "models"}[m["type"]]
    listing = _json(f"{API}/assets?t={t}")
    if m.get("id") in listing: return m["id"]
    q = [w.lower() for w in m.get("query", "").split()]
    best, score = None, -1
    for aid, a in listing.items():
        hay = " ".join([aid, a.get("name", "")] + a.get("tags", []) + a.get("categories", [])).lower()
        s = sum(1 for w in q if w in hay)
        if s > score: best, score = aid, s
    return best

def fetch(slots=None, res="2k"):
    man = manifest(); want = slots or list(man["slots"])
    for slot in want:
        m = man["slots"].get(slot)
        if not m or m.get("source") != "polyhaven": continue
        try:
            aid = _pick_asset(m)
            if not aid: log("no Poly Haven match for", slot); continue
            files = _json(f"{API}/files/{aid}"); d = _slot_dir(slot)
            if m["type"] == "hdri":
                r = m.get("res", "4k"); url = files["hdri"][r]["exr"]["url"] if r in files["hdri"] else list(files["hdri"].values())[-1]["exr"]["url"]
                _download(url, os.path.join(d, f"{aid}_{r}.exr"))
            elif m["type"] == "texture":
                for kind, keys in (("diff", ("Diffuse", "diff")), ("rough", ("Rough", "rough")), ("nor", ("nor_gl",)), ("disp", ("Displacement", "disp")), ("ao", ("AO",))):
                    for k in keys:
                        if k in files and res in files[k]:
                            fmt = "jpg" if "jpg" in files[k][res] else list(files[k][res])[0]
                            _download(files[k][res][fmt]["url"], os.path.join(d, f"{aid}_{res}_{kind}.{fmt}")); break
            else:
                g = files.get("gltf", {}); r = res if res in g else list(g)[0]
                entry = g[r]["gltf"]; _download(entry["url"], os.path.join(d, f"{aid}.gltf"))
                for name, inc in entry.get("include", {}).items():
                    sub = os.path.join(d, name); os.makedirs(os.path.dirname(sub), exist_ok=True); _download(inc["url"], sub)
            log("fetched", slot, "<-", aid)
        except Exception as e:
            log("fetch failed for", slot, ":", e)

if __name__ == "__main__":
    fetch()
