"""Total Environment Whitefield: the cloud opening and the finishing grade for the drone shot.

  .w3d/bin/python scripts/te/clouds.py IN_DIR OUT_DIR [--clear 120] [--frames 384]

IN_DIR holds the full 24 fps sequence 0001.png .. (rendered or interpolated).
The camera starts above a cloud deck and sinks through it: several layers of
procedural cumulus (fractal noise, lit from the morning sun in the east-south-east)
grow and slide outwards from the centre as the camera passes them, and the last
one has cleared by --clear frames. Then a light grade on every frame:
warm highlights, a touch of contrast, a soft vignette.
No imagery is used; the clouds are generated here, seeded, so every run matches.
"""
import sys, os, math
import numpy as np
from PIL import Image, ImageFilter

IN, OUT = sys.argv[1], sys.argv[2]; os.makedirs(OUT, exist_ok=True)
def opt(k, d): return type(d)(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
CLEAR = opt("--clear", 120); NF = opt("--frames", 384)
rng = np.random.default_rng(42)

def fbm(n, base, octaves=6):
    acc = np.zeros((n, n), np.float32); amp = 1.0; tot = 0
    for o in range(octaves):
        s = base * 2 ** o
        g = rng.random((s + 1, s + 1)).astype(np.float32)
        acc += amp * np.asarray(Image.fromarray(g).resize((n, n), Image.BICUBIC)); tot += amp; amp *= 0.52
    acc /= tot; return (acc - acc.min()) / (np.ptp(acc) + 1e-6)

def smooth(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def cloud_layer(n=2048, cover=0.5, seed_base=3):
    """RGBA cumulus sheet: density from fbm, shading from the density gradient towards the sun"""
    d = fbm(n, seed_base) * 0.75 + fbm(n, seed_base * 4, 4) * 0.25
    a = smooth(cover, cover + 0.22, d)
    h = np.asarray(Image.fromarray((d * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(6))).astype(np.float32) / 255
    gy, gx = np.gradient(h)
    sun = np.array([0.83, -0.36])            # the sun to the east-south-east, in image space (x right = east, y down = south)
    lit = np.clip(0.5 + 18 * (gx * sun[0] + gy * sun[1]), 0, 1)
    shade = 0.70 + 0.30 * lit
    core = smooth(0.0, 0.9, a)               # thicker cloud is greyer underneath
    r = np.clip(shade * (1.0 - 0.10 * core), 0, 1); g = np.clip(shade * (0.985 - 0.09 * core), 0, 1); b = np.clip(shade * (0.97 - 0.06 * core), 0, 1)
    rgb = np.stack([r * 0.99, g * 0.995, b * 1.02], -1)   # neutral white, a cool cast in the shade
    rgb = np.clip(rgb + 0.06 * (1 - a[..., None]), 0, 1)
    return np.dstack([rgb, a]).astype(np.float32)

# layers: (start depth, cover); the camera moves towards them at a steady rate and passes each in turn
LAYERS = [(1.15, 0.36), (1.6, 0.42), (2.2, 0.47), (3.0, 0.52), (3.9, 0.56)]
SHEETS = [cloud_layer(2048, c, 3 + i) for i, (_, c) in enumerate(LAYERS)]
SPEED = (LAYERS[-1][0] - 0.12) / CLEAR      # the last layer reaches the lens at CLEAR

def composite(img, f):
    H, W = img.shape[:2]
    out = img.copy()
    for (d0, _), sh in sorted(zip(LAYERS, SHEETS), key=lambda z: -z[0][0]):   # far layers first
        d = d0 - SPEED * (f - 1)
        if d <= 0.12: continue
        sc = 1.0 / d                              # apparent size grows as the layer nears
        n = sh.shape[0]; win = n / (sc * 1.6)     # the window of the sheet that fills the frame
        cx = cy = n / 2
        x0, y0 = int(cx - win / 2), int(cy - win / 2 * H / W)
        crop = sh[max(y0, 0):int(y0 + win * H / W), max(x0, 0):int(x0 + win)]
        if crop.size == 0: continue
        layer = np.asarray(Image.fromarray((crop * 255).astype(np.uint8), "RGBA").resize((W, H), Image.BICUBIC)).astype(np.float32) / 255
        fade = smooth(0.12, 0.55, d)              # a layer thins as it wraps round the lens
        a = layer[..., 3:4] * fade
        out = out * (1 - a) + layer[..., :3] * a
    # a soft white-out at the very start, so the first frame is cloud
    wo = 1 - smooth(1, 30, f)
    out = out * (1 - 0.85 * wo) + np.array([0.93, 0.94, 0.96]) * 0.85 * wo
    return out

def grade(img):
    H, W = img.shape[:2]
    lum = img.mean(-1, keepdims=True)
    img = np.clip((img - 0.06 * np.array([0.66, 0.70, 0.76])) / 0.94, 0, 1)   # lift some of the haze veil
    # the brick reads too orange once graded: pull strongly orange pixels towards a deeper terracotta
    r_, g_, b_ = img[..., 0], img[..., 1], img[..., 2]
    orange = smooth(1.25, 1.6, r_ / (g_ + 1e-3)) * smooth(0.25, 0.4, r_)
    lum0 = img.mean(-1, keepdims=True)
    img = img - (img - lum0) * (0.12 * orange[..., None])
    img = img * (1 - 0.03 * orange[..., None]) * (1 + np.array([0.0, -0.02, -0.03]) * orange[..., None])
    lum = img.mean(-1, keepdims=True)
    img = img + (img - lum) * 0.18                                 # a little saturation
    img = np.clip((img - 0.5) * 1.10 + 0.5, 0, 1)                   # a little contrast
    img = img * np.array([1.012, 1.0, 0.985]) ** (lum * 1.5)        # warm the highlights slightly (morning sun)
    yy, xx = np.mgrid[0:H, 0:W]; r = np.hypot((xx - W / 2) / (W / 2), (yy - H / 2) / (H / 2))
    img = img * (1 - 0.18 * smooth(0.6, 1.5, r))[..., None]          # vignette
    return np.clip(img, 0, 1)

frames = sorted(x for x in os.listdir(IN) if x.endswith(".png"))
for i, name in enumerate(frames):
    f = int(name[:4])
    im = np.asarray(Image.open(os.path.join(IN, name)).convert("RGB")).astype(np.float32) / 255
    if f < CLEAR + 2: im = composite(im, f)
    im = grade(im)
    Image.fromarray((im * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, name), compress_level=1)
    if i % 48 == 0: print("frame", f, flush=True)
print("done", len(frames))
