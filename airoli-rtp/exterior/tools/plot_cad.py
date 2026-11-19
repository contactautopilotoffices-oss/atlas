import sys, json
sys.path.insert(0, sys.argv[1])
import cadlib
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
S = sys.argv[2]; out = sys.argv[3]
R, box, M = cadlib.load(S + "/f4/flat.json", S + "/f4/clusters.json", 10, "/Users/lohit/Downloads/Atlas/airoli-rtp/review/frames.json")
L = cadlib.layer_lines(R, box, M, cadlib.FAC)
col = {"STRUCTURAL GLAZING": "c", "A.C.P.CLADDING": "k", "A.C.P. CLADDING": "k", "RCC  FINS": "r", "STRUCTURAL ASSEMBLY": "m", "RAILING": "orange", "walls": "#bbb", "Structural Column": "b", "WINDOW": "y", "M.S.STEEL": "g"}
for zoom, lim in (("all", None), ("east", (10, 55, -20, 115)), ("nw", (-60, 25, 75, 122)), ("south", (10, 55, -20, 20))):
    fig, ax = plt.subplots(figsize=(16, 16))
    for l in L:
        if l["L"] not in col: continue
        ax.plot(l["pts"][:, 0], l["pts"][:, 1], color=col[l["L"]], lw=0.6)
    if lim: ax.set_xlim(lim[0], lim[1]); ax.set_ylim(lim[2], lim[3])
    ax.set_aspect("equal"); ax.grid(alpha=.3); fig.savefig(f"{out}/cad_{zoom}.png", dpi=60, bbox_inches="tight"); plt.close(fig)
