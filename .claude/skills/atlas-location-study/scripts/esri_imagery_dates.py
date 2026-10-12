"""Reads the capture date of the newest Esri World Imagery at every
building-precision pin and writes it into study.json (option.img,
existing.img, meta.imagery.checked).

    python3 -I esri_imagery_dates.py study.json

Why: the page shows "satellite captured <date>" under each building photo.
That date has to come from the imagery service, not a guess; the page also
re-asks the live service when an option opens, so this is the starting
value. Mapbox's own satellite layer is often years older in Indian cities,
which is why the template uses Esri for building crops.

Uses the public identify endpoint (no key). Respects HTTPS_PROXY and
SSL_CERT_FILE if your network needs them.
"""
import json, os, re, ssl, sys, urllib.parse, urllib.request
from datetime import date

ESRI = "https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer"
path = sys.argv[1]
study = json.load(open(path, encoding="utf-8"))
ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE") or None)

def captured(lat, lng):
    d = .002
    q = urllib.parse.urlencode({
        "geometry": f"{lng},{lat}", "geometryType": "esriGeometryPoint", "sr": 4326, "layers": "all:0",
        "tolerance": 1, "mapExtent": f"{lng - d},{lat - d},{lng + d},{lat + d}", "imageDisplay": "200,200,96",
        "returnGeometry": "false", "f": "json"})
    with urllib.request.urlopen(f"{ESRI}/identify?{q}", timeout=30, context=ctx) as r:
        j = json.load(r)
    res = j.get("results") or []
    attrs = res[0].get("attributes", {}) if res else {}
    for k, v in attrs.items():
        m = re.match(r"^(20\d\d)(\d\d)(\d\d)$", str(v))
        if "DATE" in k.upper() and m: return f"{m[1]}-{m[2]}-{m[3]}", attrs
    return None, attrs

targets = [o for o in study.get("options", []) if o.get("precision") == "building"]
if study.get("existing") and study["existing"].get("precision") == "building": targets.append(study["existing"])
sources = set()
for o in targets:
    try:
        d, attrs = captured(o["lat"], o["lng"])
    except Exception as e:
        print(f"{o['id']:<28} failed: {e}"); continue
    if d: o["img"] = d
    src = attrs.get("SRC_DESC") or attrs.get("NICE_DESC") or attrs.get("Source") or ""
    res = attrs.get("SRC_RES") or attrs.get("Resolution") or ""
    if src: sources.add(f"{src}{', ' + str(res) + ' m' if res else ''}")
    print(f"{o['id']:<28} {d or 'no date'}  {src} {res}")
dates = sorted(o["img"] for o in targets if o.get("img"))
if not dates:
    sys.exit("no capture dates read; study.json left as it was (is services.arcgisonline.com reachable?)")
im = study.setdefault("meta", {}).setdefault("imagery", {})
im.update({"name": "Esri World Imagery", "checked": date.today().isoformat(),
           "credit": "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community", "src": ESRI})
if sources and not im.get("detail"): im["detail"] = "; ".join(sorted(sources))
a, b = dates[0][:7], dates[-1][:7]
fmt = lambda s: date(int(s[:4]), int(s[5:7]), 1).strftime("%b %Y")
im["captured"] = fmt(a) if a == b else f"{fmt(a)} to {fmt(b)}"
json.dump(study, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"{len(dates)} of {len(targets)} pins dated; captured {im.get('captured', '?')}")
