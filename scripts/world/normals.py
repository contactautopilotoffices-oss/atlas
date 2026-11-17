"""Normal maps for the Andheri East facade and ground textures.

  python3 scripts/world/normals.py TEX_DIR [--strength 6]

For every colour texture in TEX_DIR (the ones scripts/world/textures.py
paints, at the size the page loads), it writes <name>_n.jpg: a tangent-space
normal map from the texture's own brightness. Dark parts (window openings,
joints, shutter grooves, mortar) read as recessed, light parts (plaster,
frames, sills) as standing proud, so walls catch the sun as relief instead
of flat paint. Glass stays flat where it is uniform. Run it after
textures.py; the page uses the maps when they are there.
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

D = sys.argv[1]
S = float(sys.argv[sys.argv.index("--strength") + 1]) if "--strength" in sys.argv else 6.0
SKIP = ("_r", "_n")
for f in sorted(os.listdir(D)):
    base, ext = os.path.splitext(f)
    if ext.lower() != ".jpg" or base.endswith(SKIP) or base.startswith("leaves"): continue
    im = Image.open(os.path.join(D, f)).convert("L").filter(ImageFilter.GaussianBlur(1.2))
    h = np.asarray(im, dtype=np.float32) / 255.0
    # tileable gradients (the textures repeat), so wrap at the edges
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    n = np.dstack([-dx * S, dy * S, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    out = ((n * 0.5 + 0.5) * 255 + 0.5).clip(0, 255).astype(np.uint8)
    Image.fromarray(out, "RGB").save(os.path.join(D, base + "_n.jpg"), quality=90)
    print("normal map", base + "_n.jpg", im.size)
