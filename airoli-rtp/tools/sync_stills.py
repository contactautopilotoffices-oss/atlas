"""List each plan's delivered Cycles stills into its viewer manifest (tenants/<plan>.json "stills"), so the page's
Stills gallery shows them. Run after the interior worker copies stills to twin/web/models/<plan>/stills/.
usage: python3 airoli-rtp/tools/sync_stills.py"""
import json, os, glob
WEB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "twin", "web")
ORDER = ["reception", "open-workstations", "workstation", "meeting", "conference", "training", "cafeteria", "cabin"]
for man in sorted(glob.glob(os.path.join(WEB, "tenants", "*.json"))):
    m = json.load(open(man)); pid = m["id"]
    files = sorted(glob.glob(os.path.join(WEB, "models", pid, "stills", "*.jpg")))
    def rank(f):
        n = os.path.basename(f).lower()
        return next((i for i, k in enumerate(ORDER) if k in n), len(ORDER)), n
    m["stills"] = [{"camera": os.path.splitext(os.path.basename(f))[0].replace(pid + "_", pid + "_CAM_", 1), "src": os.path.relpath(f, WEB), "option": None} for f in sorted(files, key=rank)]
    json.dump(m, open(man, "w"), indent=1)
    print(pid, len(m["stills"]))
