"""Stage 1 of the photo to digital twin pipeline: check a folder of photos
before any reconstruction is attempted.

  python3 scripts/twin/ingest.py PHOTOS_DIR [--out ingest.json]

For every image: size, camera and lens from EXIF, GPS if present, sharpness
(variance of the Laplacian), exposure (mean, clipped highlights and shadows),
and near duplicates (a 64 bit difference hash). Writes ingest.json beside the
photos and prints what to reshoot. It never changes or drops a photo: the
originals are the evidence.
"""
import json, os, sys
import numpy as np
from PIL import Image, ExifTags

EXT = (".jpg", ".jpeg", ".png", ".tif", ".tiff", ".heic", ".webp")
TAGS = {v: k for k, v in ExifTags.TAGS.items()}

def exif(im):
    try: e = im.getexif()
    except Exception: return {}
    out = {}
    for k in ("Make", "Model", "DateTime"):
        if TAGS[k] in e: out[k.lower()] = str(e[TAGS[k]]).strip()
    try:
        ifd = e.get_ifd(0x8769)  # Exif sub IFD: lens and focal length
        for k in ("FocalLength", "FocalLengthIn35mmFilm", "ExposureTime", "ISOSpeedRatings"):
            if TAGS.get(k) in ifd: out[k.lower()] = float(ifd[TAGS[k]]) if not isinstance(ifd[TAGS[k]], tuple) else ifd[TAGS[k]]
        g = e.get_ifd(0x8825)  # GPS IFD
        if g and 2 in g and 4 in g:
            dms = lambda v: float(v[0]) + float(v[1]) / 60 + float(v[2]) / 3600
            lat, lng = dms(g[2]) * (-1 if g.get(1) == "S" else 1), dms(g[4]) * (-1 if g.get(3) == "W" else 1)
            out["gps"] = [round(lat, 7), round(lng, 7)]
    except Exception: pass
    return out

def sharpness(g):
    lap = -4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:]
    return float(lap.var())

def dhash(g):
    small = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).resize((9, 8), Image.BILINEAR), dtype=np.int16)
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return int("".join("1" if b else "0" for b in bits), 2)

def main():
    d = sys.argv[1]; out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.join(d, "ingest.json")
    files = sorted(f for f in os.listdir(d) if f.lower().endswith(EXT))
    rows = []
    for f in files:
        im = Image.open(os.path.join(d, f)); meta = exif(im)
        g = np.asarray(im.convert("L").resize((min(1024, im.width), int(min(1024, im.width) * im.height / im.width))), dtype=np.float32) / 255
        rows.append({"image": f, "size": [im.width, im.height], **meta, "sharpness": round(sharpness(g) * 1e4, 1),
                     "mean": round(float(g.mean()), 3), "clipped_hi": round(float((g > 0.98).mean()), 3), "clipped_lo": round(float((g < 0.02).mean()), 3),
                     "dhash": dhash(g)})
    # judge against the set itself: blur is relative to the sharpest photos
    if rows:
        ref = float(np.percentile([r["sharpness"] for r in rows], 75)) or 1.0
        for r in rows:
            issues = []
            if r["sharpness"] < 0.25 * ref: issues.append("blurred")
            if r["clipped_hi"] > 0.15: issues.append("overexposed")
            if r["clipped_lo"] > 0.25: issues.append("underexposed")
            if min(r["size"]) < 1000: issues.append("low resolution")
            r["issues"] = issues
        for i, a in enumerate(rows):
            for b in rows[:i]:
                if bin(a["dhash"] ^ b["dhash"]).count("1") <= 3: a.setdefault("issues", []).append(f"near duplicate of {b['image']}")
    for r in rows: r["dhash"] = f"{r['dhash']:016x}"
    report = {"photos": len(rows), "with_gps": sum(1 for r in rows if "gps" in r), "with_focal": sum(1 for r in rows if "focallength" in r),
              "flagged": [r["image"] for r in rows if r["issues"]], "images": rows}
    json.dump(report, open(out, "w"), indent=1)
    print(f"{len(rows)} photos, {report['with_gps']} with GPS, {report['with_focal']} with focal length; wrote {out}")
    for r in rows:
        if r["issues"]: print(f"  {r['image']}: {', '.join(r['issues'])}")
    if len(rows) < 20: print("  fewer than 20 photos: a full building needs 20 to 40 with strong overlap (see scripts/twin/CAPTURE.md)")

if __name__ == "__main__":
    main()
