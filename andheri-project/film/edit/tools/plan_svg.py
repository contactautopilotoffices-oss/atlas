"""CAD plan JSON -> a layered SVG for the film (one <g> per layer, each element animatable).

  python3 andheri-project/film/edit/tools/plan_svg.py PLAN_ID [PLAN_ID ...]

Reads media/flipkart-andheri/cad/<id>.json (paths already in SVG orientation, metres) and <id>-semantic.json (desks,
y north). Writes andheri-project/film/edit/assets/plans/<id>.svg plus <id>.json (bounds, totals, zone labels). Colours
are the film's dark palette: white walls, cyan glass, soft zone tints, warm desks. Furniture other than desks is left
out: at film size it reads as noise.
"""
import json, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
CAD = os.path.join(ROOT, "media/flipkart-andheri/cad"); OUT = os.path.join(ROOT, "andheri-project/film/edit/assets/plans")
for pid in sys.argv[1:]:
    d = json.load(open(os.path.join(CAD, pid + ".json"))); s = json.load(open(os.path.join(CAD, pid + "-semantic.json")))
    b = d["bounds"]; pad = 1.2
    vb = f"{b[0]-pad} {-b[3]-pad} {b[2]-b[0]+2*pad} {b[3]-b[1]+2*pad}"
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" preserveAspectRatio="xMidYMid meet">']
    out.append('<g class="zones">')
    for i, z in enumerate(d["zones"] + d.get("others", [])):
        if not z.get("d"): continue
        out.append(f'<path class="zone" data-i="{i}" d="{z["d"]}" fill="{z.get("color","#7a8aa0")}" fill-opacity="0.28" stroke="{z.get("color","#7a8aa0")}" stroke-opacity="0.75" stroke-width="0.06"/>')
    out.append('</g>')
    for layer, col, w in (("hatch", "#5d6b80", 0.02), ("walls", "#f3f5f8", 0.07), ("glass", "#7fd3ff", 0.05), ("doors", "#9aa6b8", 0.03)):
        p = d["cad"].get(layer)
        if p: out.append(f'<path class="{layer}" d="{p}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="0"/>')
    out.append('<g class="desks">')
    for k in s.get("desks", []):
        pts = " ".join(f"{x:.3f},{-y:.3f}" for x, y in k["desktop_polygon_m"])
        out.append(f'<polygon class="desk" points="{pts}" fill="#ffd27a" fill-opacity="0.92"/>')
    out.append('</g></svg>')
    open(os.path.join(OUT, pid + ".svg"), "w").write("".join(out))
    labels = [{"name": z["name"], "label": z["label"], "group": z.get("group"), "seats": z.get("seats"), "color": z.get("color")} for z in d["zones"] if z.get("label")]
    json.dump({"id": pid, "bounds": b, "desks": len(s.get("desks", [])), "totals": d.get("totals"), "zones": labels}, open(os.path.join(OUT, pid + ".json"), "w"), indent=1)
    print(pid, "desks", len(s.get("desks", [])), "totals", d.get("totals"), "svg", round(os.path.getsize(os.path.join(OUT, pid + ".svg")) / 1e3), "kB")
