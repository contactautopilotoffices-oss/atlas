"""Volt-style blueprint of an RTP plan: every line of the DWG cluster, white on blue, north-up in rtp_local.
The viewer's live CAD locator puts "you are here" on it (pixel = ((x - x0)/(x1 - x0) W, (y1 - y)/(y1 - y0) H)).
usage: python -I blueprint_rtp.py <flat.json> <clusters.json> <frames.json> <plan> <out.png> <out.json>"""
import json, sys
import numpy as np
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection

flat, clj, frj, plan, out_png, out_json = sys.argv[1:7]
F = json.load(open(frj))["plans"][plan]; M = np.array(F["cad_m_to_rtp_local"])
C = {c["cluster"]: c for c in json.load(open(clj))}[F["cluster"]]
X0, Y0 = C["x0"], C["y0"]; X1, Y1 = X0 + C["w_m"] * 1000, Y0 + C["h_m"] * 1000
R = json.load(open(flat))["rec"]
T = lambda q: tuple(M[:, :2] @ np.array([q[0] / 1000, q[1] / 1000]) + M[:, 2])
inc = lambda q: X0 <= q[0] <= X1 and Y0 <= q[1] <= Y1
WALL = {"walls", "WALL", "Column", "Structural Column", "PARTITION", "PR-FULL HT", "WS-WALL-PRTN", "RAILING", "STAIR", "ELE"}
GLASS = {"STRUCTURAL GLAZING", "WINDOW", "PR- GLASS", "DR-GLASS", "WS-DOOR-GLAZ", "PR-ALU SECTION"}
SKIP = {"OUTER DIM", "OUTER DIM 1", "WDDIM", "Defpoints", "CONST", "Column No.", "colno", "wall hatch", "column-hatch", "HATCH", "HATCH-WALL", "section", "Expansion Joint", "duct"}
walls, glass, furn, texts = [], [], [], []
for r in R:
    L = r["L"]
    if L in SKIP: continue
    if r.get("txt"):
        p = r.get("p")
        if p and isinstance(p[0], (int, float)) and inc(p) and len(r["txt"]) < 60 and not r["txt"].strip().isdigit() and not (len(r["txt"].strip()) <= 4 and r["txt"].strip()[:1] in "C"):
            texts.append((T(p), r["txt"].replace("\\L", "").strip()))
        continue
    p = r.get("p")
    if r["t"] in ("INS", "HATCH") or not p or isinstance(p[0], (int, float)) or len(p) < 2: continue
    if not any(inc(q) for q in p): continue
    P = [T(q) for q in p]
    (walls if L in WALL else glass if L in GLASS else furn).append(P)
allp = np.array([q for s in walls + glass for q in s])
PAD = 3.0
x0, y0 = allp.min(0) - PAD; x1, y1 = allp.max(0) + PAD
W_PX = 4096; H_PX = round(W_PX * (y1 - y0) / (x1 - x0))
fig = plt.figure(figsize=(W_PX / 256, H_PX / 256), dpi=256); ax = fig.add_axes([0, 0, 1, 1])
BG = "#123b7a"; ax.set_facecolor(BG); fig.patch.set_facecolor(BG)
for g in np.arange(np.floor(x0), x1, 1): ax.axvline(g, color="#ffffff", lw=.2 if g % 5 else .45, alpha=.08 if g % 5 else .18)
for g in np.arange(np.floor(y0), y1, 1): ax.axhline(g, color="#ffffff", lw=.2 if g % 5 else .45, alpha=.08 if g % 5 else .18)
ax.add_collection(LineCollection(furn, lw=.35, color="#cfe2ff", alpha=.8))
ax.add_collection(LineCollection(glass, lw=.7, color="#7fd6ff"))
ax.add_collection(LineCollection(walls, lw=1.0, color="#ffffff"))
for (x, y), t in texts:
    ax.text(x, y, t, fontsize=2.6, color="#ffffff", alpha=.92, va="top", family="DejaVu Sans", linespacing=1.05)
# north arrow + scale bar, bottom-left
ax.annotate("", xy=(x0 + 4, y0 + 9), xytext=(x0 + 4, y0 + 4), arrowprops=dict(arrowstyle="-|>", color="#ffffff", lw=1.2))
ax.text(x0 + 4, y0 + 9.6, "N", color="#ffffff", fontsize=7, ha="center", weight="bold")
ax.plot([x0 + 8, x0 + 18], [y0 + 4, y0 + 4], color="#ffffff", lw=1.4); ax.text(x0 + 13, y0 + 4.6, "10 m", color="#ffffff", fontsize=5, ha="center")
ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect("equal"); ax.axis("off")
fig.savefig(out_png, dpi=256, facecolor=BG)
json.dump({"bounds": [round(float(x0), 3), round(float(y0), 3), round(float(x1), 3), round(float(y1), 3)], "px": [W_PX, H_PX], "plan": plan,
           "frame": "rtp_local (x east, y north, m from the Maps pin)",
           "about": "Blueprint drawn from the DWG's own lines. pixel = ((x - x0) / (x1 - x0) * W, (y1 - y) / (y1 - y0) * H)."}, open(out_json, "w"))
print(plan, W_PX, H_PX, len(walls), len(glass), len(furn), len(texts))
