"""Survey a flattened DWG: layers, top blocks, texts, extents, plus an overview PNG.
usage: python -I survey.py flat.json outdir"""
import json, sys, collections, os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
d = json.load(open(src))
R = d["rec"]

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

keys = collections.Counter()
for r in R[:3000]:
    keys.update(r.keys())
lay = collections.Counter(r["L"] for r in R)
lay_t = collections.defaultdict(collections.Counter)
for r in R:
    lay_t[r["L"]][r["t"]] += 1
top = collections.Counter()
seen = set()
for r in R:
    if r.get("top") and r.get("th") is not None:
        k = (r["top"], r["th"])
        if k not in seen:
            seen.add(k); top[r["top"]] += 1
top_any = collections.Counter(r.get("top") for r in R if r.get("top"))
texts = []
for r in R:
    t = r.get("txt") or r.get("text")
    if t:
        p = next(pts(r), (None, None))
        texts.append((r["L"], t.strip()[:80], round(p[0]) if p[0] is not None else None, round(p[1]) if p[1] is not None else None))
xs, ys = [], []
for r in R:
    for x, y in pts(r):
        xs.append(x); ys.append(y)

rep = {
    "record_keys": keys.most_common(),
    "layers": {k: dict(lay_t[k]) for k, _ in lay.most_common()},
    "top_block_instances": top.most_common(80),
    "top_block_records": top_any.most_common(80),
    "n_text": len(texts),
    "texts": texts,
    "x": [min(xs), max(xs)] if xs else None,
    "y": [min(ys), max(ys)] if ys else None,
    "paper": d.get("paper"),
}
json.dump(rep, open(os.path.join(out, "survey.json"), "w"), indent=1)

# overview plot, coloured by layer
fig, ax = plt.subplots(figsize=(22, 22), dpi=110)
cmap = plt.get_cmap("tab20")
li = {k: i for i, (k, _) in enumerate(lay.most_common())}
for r in R:
    P = list(pts(r))
    if r.get("rings"):
        for ring in r["rings"]:
            if r.get("solid"):
                continue
            ax.plot([q[0] for q in ring], [q[1] for q in ring], lw=0.15, color=cmap(li[r["L"]] % 20))
        continue
    if len(P) >= 2:
        ax.plot([p[0] for p in P], [p[1] for p in P], lw=0.2, color=cmap(li[r["L"]] % 20))
for L, t, x, y in texts:
    if x is not None:
        ax.text(x, y, t, fontsize=3, color="k")
ax.set_aspect("equal"); ax.axis("off")
fig.savefig(os.path.join(out, "overview.png"), bbox_inches="tight")
print("records", len(R), "texts", len(texts), "x", rep["x"], "y", rep["y"])
print("layers:", [(k, v) for k, v in lay.most_common(40)])
print("top blocks:", top.most_common(40))
