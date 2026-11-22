"""Verify the model's layout against Google satellite imagery (Map Tiles API, 2D satellite).

  GOOGLE_MAPS_KEY=... python3 scripts/world/verify_overlay.py SCENE.json REFS.json LAT LNG RADIUS_M OUT.png [x,y;x,y gates]

Fetches satellite tiles around (LAT, LNG) at zoom 19 into a private working image, then draws on it: every
footprint the builder uses (cyan), buildings added from survey (magenta), surveyed buildings (yellow dots) and
the given gate points (red). The output is a verification sheet for review only: Google imagery must not be
packed into a model, exported, or published, so the PNG stays out of the repository and the explorer.
"""
import json, math, os, sys, io, urllib.request
from PIL import Image, ImageDraw

KEY = os.environ["GOOGLE_MAPS_KEY"]
SCENE, REFS, LAT, LNG, R, OUT = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]), sys.argv[6]
GATES = [tuple(float(v) for v in g.split(",")) for g in sys.argv[7].split(";")] if len(sys.argv) > 7 else []
Z = 19
S = json.load(open(SCENE)); J = json.load(open(REFS)); K = S["k"]; O = S["origin"]

def req(url, body=None):
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body else None, headers={"Content-Type": "application/json"})
    return urllib.request.urlopen(r, timeout=30).read()
sess = json.loads(req(f"https://tile.googleapis.com/v1/createSession?key={KEY}", {"mapType": "satellite", "language": "en-US", "region": "IN"}))["session"]

def wpx(lat, lng):   # world pixel at zoom Z (256 px tiles)
    s = math.sin(math.radians(lat)); n = 256 * 2 ** Z
    return (lng + 180) / 360 * n, (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
mpp = 156543.03392 * math.cos(math.radians(LAT)) / 2 ** Z
cx, cy = wpx(LAT, LNG); half = R / mpp
x0, y0, x1, y1 = cx - half, cy - half, cx + half, cy + half
img = Image.new("RGB", (int(x1 - x0), int(y1 - y0)))
for tx in range(int(x0 // 256), int(x1 // 256) + 1):
    for ty in range(int(y0 // 256), int(y1 // 256) + 1):
        t = Image.open(io.BytesIO(req(f"https://tile.googleapis.com/v1/2dtiles/{Z}/{tx}/{ty}?session={sess}&key={KEY}")))
        img.paste(t.convert("RGB"), (int(tx * 256 - x0), int(ty * 256 - y0)))
d = ImageDraw.Draw(img)
def P(x, y):   # scene metres -> image px
    lng = O[0] + x / K[0]; lat = O[1] + y / K[1]; px, py = wpx(lat, lng); return (px - x0, py - y0)
for b in S["buildings"]:
    pts = [P(*p) for p in b["p"]]
    if all(-50 < a < img.size[0] + 50 and -50 < c < img.size[1] + 50 for a, c in pts[:1]):
        d.line(pts + [pts[0]], fill=(255, 220, 0) if b.get("opt") else (0, 230, 255), width=3 if b.get("opt") else 2)
for e in J.get("added", []):
    pts = [P(*p) for p in e["poly"]]; d.line(pts + [pts[0]], fill=(255, 0, 255), width=3)
for e in J.get("buildings", []):
    a, c = P(e["x"], e["y"]); d.ellipse([a - 4, c - 4, a + 4, c + 4], fill=(255, 220, 0))
for gx, gy in GATES:
    a, c = P(gx, gy); d.ellipse([a - 7, c - 7, a + 7, c + 7], outline=(255, 40, 40), width=3)
d.rectangle([0, img.size[1] - 22, img.size[0], img.size[1]], fill=(0, 0, 0))
d.text((6, img.size[1] - 18), "Verification only. Imagery: Google. Cyan: map footprints; yellow: property; magenta: added from survey; red: gates", fill=(255, 255, 255))
img.save(OUT); print("wrote", OUT, img.size, "m/px", round(mpp, 3))
