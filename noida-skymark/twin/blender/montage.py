"""Overview of a tenant's camera review: the first (entry) tile of every room's contact sheet, labelled, on one PNG.
   python3 montage.py <out>/review [kind_index 0..3] -> <out>/review/overview_<kind>.png"""
import os, sys, glob
from PIL import Image, ImageDraw
d = sys.argv[1]; k = int(sys.argv[2]) if len(sys.argv) > 2 else 0
tiles = []
for p in sorted(glob.glob(os.path.join(d, "contact_*.png"))):
    im = Image.open(p).convert("RGB"); w, h = 480, 270; cols = 2; r, c = divmod(k, cols)
    if im.height < (r + 1) * h: continue
    t = im.crop((c * (w + 6), r * (h + 6), c * (w + 6) + w, r * (h + 6) + h)).resize((320, 180))
    ImageDraw.Draw(t).rectangle((0, 0, 320, 16), fill=(0, 0, 0)); ImageDraw.Draw(t).text((4, 2), os.path.basename(p)[8:-4][:48], fill=(255, 255, 0))
    tiles.append(t)
n = 4; rows = (len(tiles) + n - 1) // n; M = Image.new("RGB", (n * 322, rows * 182), (30, 30, 30))
for i, t in enumerate(tiles): M.paste(t, ((i % n) * 322, (i // n) * 182))
out = os.path.join(d, f"overview_{['entry', 'feature', 'reverse', 'detail'][k]}.png"); M.save(out); print(out, len(tiles))
