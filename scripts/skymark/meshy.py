"""Generate a textured 3D model with Meshy (text to 3D), for the dioramas.

  MESHY_API_KEY=... python3 scripts/skymark/meshy.py OUT.glb "prompt" "texture prompt" [polycount] [--preview-id ID]

Runs a preview (geometry, about 20 credits), then a refine pass with PBR
textures (about 10), and downloads the GLB and its thumbnail. The free plan
queues one task at a time, so run models one after another. The key comes
from the environment only; never commit it. Needs api.meshy.ai and
assets.meshy.ai in the environment's allowed domains.
"""
import json, os, sys, time, urllib.request

KEY = os.environ["MESHY_API_KEY"]
API = "https://api.meshy.ai/openapi/v2/text-to-3d"

def call(method, url, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r: return json.loads(r.read())

def wait(task):
    while True:
        d = call("GET", f"{API}/{task}")
        print(task[:8], d.get("status"), d.get("progress"), flush=True)
        if d["status"] in ("SUCCEEDED", "FAILED", "CANCELED", "EXPIRED"): return d
        time.sleep(12)

def submit(body):
    for _ in range(60):   # one pending task at a time on the free plan
        try: return call("POST", API, body)["result"]
        except urllib.error.HTTPError as e:
            msg = e.read().decode()
            if "NoMorePendingTasks" not in msg: raise SystemExit(msg)
            time.sleep(15)
    raise SystemExit("queue never freed")

out, prompt, tex = sys.argv[1], sys.argv[2], sys.argv[3]
poly = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4].isdigit() else 10000
pid = sys.argv[sys.argv.index("--preview-id") + 1] if "--preview-id" in sys.argv else None
if not pid:
    pid = submit({"mode": "preview", "prompt": prompt, "art_style": "realistic", "should_remesh": True, "topology": "triangle", "target_polycount": poly})
    if wait(pid)["status"] != "SUCCEEDED": raise SystemExit("preview failed")
rid = submit({"mode": "refine", "preview_task_id": pid, "enable_pbr": True, "texture_prompt": tex})
d = wait(rid)
if d["status"] != "SUCCEEDED": raise SystemExit("refine failed")
urllib.request.urlretrieve(d["model_urls"]["glb"], out)
urllib.request.urlretrieve(d["thumbnail_url"], out[:-4] + ".png")
json.dump({"prompt": prompt, "texture": tex, "preview": pid, "refine": rid}, open(out[:-4] + ".json", "w"), indent=1)
print("saved", out, os.path.getsize(out))
