"""Find drawing clusters (separate sheets/plans in model space) and plot each.
usage: python -I clusters.py flat.json outdir"""
import json, sys, os, collections
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src)); R = d["rec"]
CELL = 5000.0  # 5 m bins (mm)

def pts(r):
    v = r.get("p")
    if isinstance(v, (list, tuple)) and v:
        if isinstance(v[0], (int, float)):
            yield v[0], v[1]
        else:
            for q in v:
                if isinstance(q, (list, tuple)) and len(q) >= 2:
                    yield q[0], q[1]
    for ring in r.get("rings") or []:
        for q in ring:
            yield q[0], q[1]

def rep(r):
    for x, y in pts(r):
        return x, y
    return None

cells = collections.Counter()
for r in R:
    p = rep(r)
    if p: cells[(int(p[0] // CELL), int(p[1] // CELL))] += 1
# flood fill cells with 1-cell gap tolerance
lab = {}; n = 0
for c in cells:
    if c in lab: continue
    n += 1; st = [c]; lab[c] = n
    while st:
        a = st.pop()
        for dx in (-2, -1, 0, 1, 2):
            for dy in (-2, -1, 0, 1, 2):
                b = (a[0] + dx, a[1] + dy)
                if b in cells and b not in lab:
                    lab[b] = n; st.append(b)
cl = collections.defaultdict(list)
for i, r in enumerate(R):
    p = rep(r)
    if p: cl[lab[(int(p[0] // CELL), int(p[1] // CELL))]].append(i)
info = []
for k, idx in sorted(cl.items(), key=lambda kv: -len(kv[1])):
    xs = []; ys = []
    for i in idx:
        for x, y in pts(R[i]): xs.append(x); ys.append(y)
    tx = [R[i]["txt"].strip()[:60] for i in idx if R[i].get("txt")]
    lay = collections.Counter(R[i]["L"] for i in idx)
    blocks = collections.Counter()
    seen = set()
    for i in idx:
        r = R[i]
        if r.get("top") and (r["top"], r.get("th")) not in seen:
            seen.add((r["top"], r.get("th"))); blocks[r["top"]] += 1
    info.append({"cluster": k, "n": len(idx), "w_m": round((max(xs) - min(xs)) / 1000, 1),
                 "h_m": round((max(ys) - min(ys)) / 1000, 1), "x0": min(xs), "y0": min(ys),
                 "layers": lay.most_common(12), "blocks": blocks.most_common(15), "texts": tx})
json.dump(info, open(os.path.join(out, "clusters.json"), "w"), indent=1)
for c in info[:8]:
    print(f"#{c['cluster']} n={c['n']} {c['w_m']}x{c['h_m']} m  texts={len(c['texts'])}")
    print("   layers", c["layers"][:8]); print("   blocks", c["blocks"][:8])
    print("   texts", sorted(set(c["texts"]))[:60])

# plot the top clusters
for c in info[:4]:
    if c["n"] < 200: continue
    idx = cl[c["cluster"]]
    lays = collections.Counter(R[i]["L"] for i in idx)
    li = {k: j for j, (k, _) in enumerate(lays.most_common())}
    cm = plt.get_cmap("tab20")
    fig, ax = plt.subplots(figsize=(24, 24 * max(0.3, c["h_m"] / max(c["w_m"], 1))), dpi=100)
    for i in idx:
        r = R[i]; col = cm(li[r["L"]] % 20)
        if r.get("rings"):
            if r.get("solid"): continue
            for ring in r["rings"]:
                ax.plot([q[0] for q in ring], [q[1] for q in ring], lw=0.12, color=col)
        elif r.get("txt"):
            p = rep(r)
            ax.text(p[0], p[1], r["txt"].strip()[:40], fontsize=4.5, color="k")
        else:
            P = list(pts(r))
            if len(P) >= 2: ax.plot([p[0] for p in P], [p[1] for p in P], lw=0.25, color=col)
    hs = [plt.Line2D([], [], color=cm(j % 20), lw=3, label=k) for k, j in list(li.items())[:20]]
    ax.legend(handles=hs, loc="upper left", fontsize=8)
    ax.set_aspect("equal"); ax.axis("off")
    fig.savefig(os.path.join(out, f"cluster_{c['cluster']}.png"), bbox_inches="tight"); plt.close(fig)
