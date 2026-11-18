"""Summarise a GLB: node tree roots, extensions, materials, textures, triangle count. usage: python3 inspect_glb.py file.glb"""
import json, struct, sys, collections
for path in sys.argv[1:]:
    d = open(path, "rb").read(); jl = struct.unpack("<I", d[12:16])[0]; js = json.loads(d[20:20 + jl])
    sc = js["scenes"][js.get("scene", 0)]; nodes = js["nodes"]
    roots = [nodes[i].get("name") for i in sc["nodes"]]
    inst = sum(1 for i in sc["nodes"] if "EXT_mesh_gpu_instancing" in nodes[i].get("extensions", {}))
    mats = [m.get("name") for m in js.get("materials", [])]
    print(path, f"{len(d) / 1e6:.2f} MB")
    print("  extensionsUsed", js.get("extensionsUsed")); print("  roots", len(roots), roots[:14], "... instanced roots", inst)
    print("  materials", len(mats), mats[:60])
    print("  images", len(js.get("images", [])), "textures", len(js.get("textures", [])))
    uv1 = sum(1 for m in js["meshes"] for p in m["primitives"] if "TEXCOORD_1" in p["attributes"]); col = sum(1 for m in js["meshes"] for p in m["primitives"] if "COLOR_0" in p["attributes"])
    print("  primitives with TEXCOORD_1", uv1, "with COLOR_0", col)
    for i in sc["nodes"][:3]:
        n = nodes[i]; print("  e.g.", n.get("name"), "children", [nodes[c].get("name") for c in n.get("children", [])][:10], "extras", {k: v for k, v in (n.get("extras") or {}).items() if k in ("ffl", "level", "lightmap")})
