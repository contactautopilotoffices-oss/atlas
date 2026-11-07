"""Light post for a Cycles still, as the realism playlist advises: a very small
blur so it is not razor CG, fine grain like a camera's, a soft vignette, then a
web JPEG.

  python3 scripts/skymark/blender/post.py IN.png OUT.jpg [--grain 0.012] [--vignette 0.18]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

src, out = sys.argv[1], sys.argv[2]
arg = lambda k, d: float(sys.argv[sys.argv.index(k) + 1]) if k in sys.argv else d
im = Image.open(src).convert("RGB").filter(ImageFilter.GaussianBlur(0.35))
a = np.asarray(im).astype(np.float32) / 255.0
h, w, _ = a.shape
rng = np.random.default_rng(3)
g = rng.normal(0, arg("--grain", 0.012), (h, w, 1)).astype(np.float32)
a = a + g * (0.35 + 0.65 * (1 - a.mean(axis=2, keepdims=True)))   # grain shows more in the shadows
yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
r = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2) / np.sqrt(2)
a = a * (1 - arg("--vignette", 0.18) * r[..., None] ** 2.2)
Image.fromarray((np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out, quality=88, optimize=True, progressive=True)
print("saved", out)
