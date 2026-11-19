"""Copy a tenant's stills, part masks and option renders to noida-skymark/twin/web/models/<tenant>/ (the web viewer's
folder): stills/<camera>.png (+ <camera>_mask_<part>.png), options/<group>-<choice>_<camera>.png, and an index
media.json. Run after the stills and option renders.   python3 publish_media.py <tenant> <out>"""
import json, os, shutil, sys, glob
T, OUT = sys.argv[1], sys.argv[2]
web = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "models", T))
os.makedirs(os.path.join(web, "stills"), exist_ok=True); os.makedirs(os.path.join(web, "options"), exist_ok=True)
media = {"stills": [], "options": []}
for p in sorted(glob.glob(os.path.join(OUT, "stills", "*.png"))):
    shutil.copy(p, os.path.join(web, "stills", os.path.basename(p)))
    if "_mask_" not in p: media["stills"].append("stills/" + os.path.basename(p))
for p in sorted(glob.glob(os.path.join(OUT, "review", "option_*.png"))):
    n = os.path.basename(p)[len("option_"):]; shutil.copy(p, os.path.join(web, "options", n)); media["options"].append("options/" + n)
json.dump(media, open(os.path.join(web, "media.json"), "w"), indent=1); print(web, {k: len(v) for k, v in media.items()})
