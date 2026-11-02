"""Finish the Blender stills for the web.

  python scripts/world/finish.py RENDER_DIR MEDIA_DIR

From hero.png (and its .labels.json, where the seven options fell in the
frame) it makes:
  MEDIA_DIR/world/hero.jpg              the 3D page's loading poster
  MEDIA_DIR/blender-wide.{webp,jpg}     the atlas sign-in backdrop (no labels)
  MEDIA_DIR/blender-tall.{webp,jpg}     the same, cropped for phones
and from opt-<id>.png the panel renders MEDIA_DIR/world/opt-<id>.jpg.

The look: the far edge of the model fades into haze, a tilt-shift blur at
top and bottom gives the miniature ("dollhouse") read, a light grade, and
each option is labelled with its number and its name from the deck.
"""
import sys, os, json
from PIL import Image, ImageFilter, ImageDraw, ImageFont, ImageEnhance

R, MEDIA = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(MEDIA, "world"), exist_ok=True)
BUNDLE = json.load(open("examples/flipkart-andheri.bundle.json"))
NAMES = {o["id"]: (o["n"], o["name"]) for o in BUNDLE["options"]}
FONT = "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf"
MONO = "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf"
def font(p, s):
    try: return ImageFont.truetype(p, s)
    except Exception: return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", s)

def grade(im, haze=(222, 214, 200), top=0.34, tilt=True):
    W, H = im.size
    if tilt:
        blur = im.filter(ImageFilter.GaussianBlur(W / 520))
        m = Image.new("L", (1, H))
        for y in range(H):
            t = y / H
            a = 1 - min(1, max(0, (t - 0.12) / 0.24)) if t < 0.36 else min(1, max(0, (t - 0.78) / 0.2))
            m.putpixel((0, y), int(255 * a))
        im = Image.composite(blur, im, m.resize((W, H)))
    if top:
        fog = Image.new("RGB", (W, H), haze); m = Image.new("L", (1, H))
        for y in range(H):
            t = y / H; m.putpixel((0, y), int(255 * max(0, 1 - t / top) ** 1.6))
        im = Image.composite(fog, im, m.resize((W, H)))
    im = ImageEnhance.Color(im).enhance(1.12); im = ImageEnhance.Contrast(im).enhance(1.05)
    # vignette
    v = Image.new("L", (W, H), 0); d = ImageDraw.Draw(v); d.ellipse((-W * 0.2, -H * 0.25, W * 1.2, H * 1.25), fill=255)
    v = v.filter(ImageFilter.GaussianBlur(W / 10)); dark = ImageEnhance.Brightness(im).enhance(0.72)
    return Image.composite(im, dark, v)

def labels(im, pos, scale=1.0):
    W, H = im.size; d = ImageDraw.Draw(im, "RGBA")
    f, fn = font(FONT, int(26 * scale)), font(MONO, int(20 * scale))
    placed = []
    for oid, (x, y, z) in sorted(pos.items(), key=lambda kv: kv[1][1]):
        if z <= 0 or not (0 < x < 1 and 0 < y < 1): continue
        n, name = NAMES[oid]; px, py = x * W, y * H
        ly = py - 70 * scale
        for (qx, qy) in placed:
            if abs(qx - px) < 330 * scale and abs(qy - ly) < 44 * scale: ly = qy - 48 * scale
        placed.append((px, ly))
        d.line([(px, py), (px, ly + 18 * scale)], fill=(255, 255, 255, 200), width=max(2, int(2 * scale)))
        d.ellipse((px - 7 * scale, py - 7 * scale, px + 7 * scale, py + 7 * scale), fill=(224, 138, 79, 255), outline=(255, 255, 255, 230), width=max(2, int(2 * scale)))
        tw = d.textlength(name, font=f); bw = tw + 64 * scale; bh = 40 * scale
        x0 = px - bw / 2; d.rounded_rectangle((x0, ly - bh / 2, x0 + bw, ly + bh / 2), radius=bh / 2, fill=(16, 18, 22, 215), outline=(255, 255, 255, 60))
        r = 15 * scale; cx = x0 + 6 * scale + r
        d.ellipse((cx - r, ly - r, cx + r, ly + r), fill=(224, 138, 79, 255))
        d.text((cx, ly), f"{n:02d}", font=fn, fill=(26, 16, 6, 255), anchor="mm")
        d.text((cx + r + 10 * scale, ly), name, font=f, fill=(243, 237, 228, 255), anchor="lm")
    return im

def save(im, path, q=84):
    im.convert("RGB").save(path + ".jpg", quality=q, optimize=True, progressive=True)
    im.convert("RGB").save(path + ".webp", quality=q - 4, method=6)

hero = Image.open(os.path.join(R, "hero.png")).convert("RGB")
pos = json.load(open(os.path.join(R, "hero.labels.json")))
g = grade(hero)
lab = labels(g.copy(), pos, hero.size[0] / 2560)
lab.resize((1920, 1080), Image.LANCZOS).convert("RGB").save(os.path.join(MEDIA, "world", "hero.jpg"), quality=82, optimize=True, progressive=True)
# the sign-in backdrop carries no labels: the page sets its own title over it
save(g.resize((2048, 1152), Image.LANCZOS), os.path.join(MEDIA, "blender-wide"))
W, H = g.size; cw = int(H * 0.62); cx = int(W * 0.56)
save(g.crop((cx - cw // 2, 0, cx + cw // 2, H)).resize((900, int(900 * H / cw)), Image.LANCZOS), os.path.join(MEDIA, "blender-tall"))
for n in (("night", "dusk") if "--moods" in sys.argv else ()):
    p = os.path.join(R, f"{n}.png")
    if os.path.exists(p):
        im = grade(Image.open(p).convert("RGB"), haze=(20, 26, 44) if n == "night" else (232, 170, 120), top=0.3)
        lp = os.path.join(R, f"{n}.labels.json")
        if os.path.exists(lp): im = labels(im, json.load(open(lp)), im.size[0] / 2560)
        im.resize((1920, 1080), Image.LANCZOS).convert("RGB").save(os.path.join(MEDIA, "world", f"{n}.jpg"), quality=82, optimize=True, progressive=True)
for f in sorted(os.listdir(R)):
    if f.startswith("opt-") and f.endswith(".png"):
        im = grade(Image.open(os.path.join(R, f)).convert("RGB"), top=0.18, tilt=True)
        oid = f[4:-4]; lp = os.path.join(R, f[:-4] + ".labels.json")
        if os.path.exists(lp): im = labels(im, {oid: json.load(open(lp))[oid]}, im.size[0] / 1600 * 1.15)
        im.resize((1200, 750), Image.LANCZOS).convert("RGB").save(os.path.join(MEDIA, "world", f[:-4] + ".jpg"), quality=80, optimize=True, progressive=True)
print("finished", sorted(os.listdir(os.path.join(MEDIA, "world"))))
