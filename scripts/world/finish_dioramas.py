"""Finish the diorama stills for the explorer.

  python scripts/world/finish_dioramas.py RENDER_DIR MEDIA_DIR

<id>-close.png (an aerial of the building in its block) becomes the
filmstrip card, MEDIA_DIR/r/<id>-close.jpg, with a light tilt-shift so it
reads as a model. <id>-street.png (from the footpath, verticals straight)
becomes the photo in the building's details, MEDIA_DIR/r/<id>-street.jpg.
"""
import os, sys
from PIL import Image, ImageFilter, ImageEnhance

R, MEDIA = sys.argv[1], sys.argv[2]
OUT = os.path.join(MEDIA, "r"); os.makedirs(OUT, exist_ok=True)

def tilt(im, k=1.0):
    W, H = im.size; blur = im.filter(ImageFilter.GaussianBlur(W / 600 * k)); m = Image.new("L", (1, H))
    for y in range(H):
        t = y / H; a = 1 - min(1, max(0, (t - 0.1) / 0.25)) if t < 0.35 else min(1, max(0, (t - 0.75) / 0.22))
        m.putpixel((0, y), int(255 * a))
    return Image.composite(blur, im, m.resize((W, H)))

def grade(im):
    im = ImageEnhance.Color(im).enhance(1.08); return ImageEnhance.Contrast(im).enhance(1.04)

done = []
for f in sorted(os.listdir(R)):
    if not f.endswith(".png"): continue
    im = Image.open(os.path.join(R, f)).convert("RGB")
    if f.endswith("-close.png"):
        im = grade(tilt(im)); im.resize((960, 600), Image.LANCZOS).save(os.path.join(OUT, f[:-4] + ".jpg"), quality=80, optimize=True, progressive=True)
    elif f.endswith("-street.png"):
        im = grade(im); im.resize((1200, int(1200 * im.size[1] / im.size[0])), Image.LANCZOS).save(os.path.join(OUT, f[:-4] + ".jpg"), quality=82, optimize=True, progressive=True)
    else: continue
    done.append(f)
print("finished", done)
