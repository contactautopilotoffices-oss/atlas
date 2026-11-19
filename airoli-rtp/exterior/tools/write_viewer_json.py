"""Write twin/web/models/exterior/exterior_viewer.json from the build, bake, export and render logs (plain python3)."""
import json, os, math, shutil, glob
EXT = "/Users/lohit/Downloads/Atlas/airoli-rtp/exterior"; B = EXT + "/_build"; WEB = "/Users/lohit/Downloads/Atlas/airoli-rtp/twin/web/models/exterior"
P = json.load(open(B + "/prep/prep.json")); R = P["rtp"]
ex = json.load(open(B + "/export/export_info.json")) if os.path.exists(B + "/export/export_info.json") else {}
bake = json.load(open(B + "/lightmaps/bake_info.json")) if os.path.exists(B + "/lightmaps/bake_info.json") else {}
stl = json.load(open(EXT + "/stills/stills_log.json")) if os.path.exists(EXT + "/stills/stills_log.json") else {}
envl = {}
for f in glob.glob(EXT + "/stills/env_log*.json"): envl.update(json.load(open(f)))
def three(v): return [round(v[0], 3), round(v[2], 3), round(-v[1], 3)]
floors = []
for f in R["floors"]:
    n = f["level"]; nm = f["name"]; tag = f"_L{n:02d}" if n in (4, 6) else ""
    floors.append({"level": n if n < R["nlev"] else "roof", "node": nm, "ffl_m": f["ffl"], "ffl_three_y": f["ffl"],
                   "height_m": R["ftf"] if n < R["nlev"] else None,
                   "children": [f"{nm}_{p}" for p in ("slab", "acp", "glass", "solid", "mullions", "fins", "interior", "railing")],
                   "materials": {"glass": "facade_glass" + tag, "slab": "rtp_slab" + tag, "acp": "rtp_acp" + tag, "interior": f"rtp_interior_L{n:02d}"} if n < R["nlev"] else {"roof": "rtp_roof"},
                   "offered": n in (4, 6)})
states = {}
lit = {0: 1.0, 1: 1.0, 2: 0.85, 3: 1.0, 4: 1.0, 5: 0.7, 6: 1.0, 7: 0.9, 8: 0.6, 9: 0.8}
for k, s in P["states"].items():
    d = s["dir_to_sun_rtp_local"]
    states[k] = {"time_ist": s["time"], "date": P["date"], "sun_azimuth_deg": s["azimuth_deg"], "sun_elevation_deg": s["elevation_deg"],
                 "dir_to_sun_rtp_local": d, "dir_to_sun_three": three(d),
                 "sun_up": s["elevation_deg"] > 0, "sunmap_channel": {"morning": "r", "golden": "g", "midday": "b"}.get(k, "b" if s["elevation_deg"] > 20 else ("g" if s["elevation_deg"] > 0 else None)),
                 "env_map": f"env/rtp_env_{'night' if k in ('night', 'blue_hour') else 'day'}.hdr",
                 "emissive_intensity": {"rtp_interior_Lnn": {f"L{n:02d}": (round(3.2 * lit[n], 2) if k in ("night", "blue_hour") else 0.25) for n in lit},
                                        "sign_red": 14.0 if k in ("night", "blue_hour") else 0.4, "sign_white": 9.0 if k in ("night", "blue_hour") else 0.3,
                                        "prop_lamp_led": 30.0 if k in ("night", "blue_hour") else 0.0,
                                        "ctx_house_wall_a|ctx_house_wall_b|ctx_block_wall": 1.6 if k in ("night", "blue_hour") else 0.0,
                                        "ctxB_glass_curtain|ctxB_glass_curtain_b|ctxB_punched": 0.65 if k in ("night", "blue_hour") else 0.0},
                 "facade_uplights": ({"colours": ["#ff40bf", "#8c47ff"], "spacing_m": 9.0, "note": "alternating pink / violet spots at the RTP base aimed up the facade"} if k in ("night", "blue_hour") else None),
                 "fog": {"morning": {"color": "#c9d3dc", "density": 0.00030}, "midday": {"color": "#d3dbe2", "density": 0.00022}, "golden": {"color": "#e8c9a6", "density": 0.00045},
                         "blue_hour": {"color": "#4a5670", "density": 0.00035}, "night": {"color": "#2a2430", "density": 0.00030}}[k]}
man = {
    "name": "Reliable Tech Park, MIDC Airoli: exterior",
    "frame": "rtp_local metres (x east, y north from the Maps pin 19.1692159 N 73.0017703 E, z up). GLBs are glTF Y-up: three (x, y, z) = rtp_local (x, z, -y). Not recentred.",
    "files": ex.get("files", {}), "decoder": "GLTFLoader.setMeshoptDecoder(MeshoptDecoder); repeated props arrive as EXT_mesh_gpu_instancing (InstancedMesh)",
    "floors": floors,
    "floor_reveal": {"how": "each rtp_Lnn node holds that floor (slab, ACP band, glass, mullions, fins, interior backdrop). Slide it out along its outward axis, "
                            "hide every node above it, and load the interior GLB at ffl_three_y.", "offered_floors": ["rtp_L04", "rtp_L06"],
                     "tint": "rtp_L04 / rtp_L06 have their own glass, slab, ACP and interior materials, so they can glow as coloured bands"},
    "states": states,
    "lightmaps": {
        "how": "Lightmapped nodes (listed below) carry a 2nd UV (TEXCOORD_1). Three maps per atlas: "
               "day (lightMap, sRGB, channel 1, lightMapIntensity per node: the existing Skymark path, B = 0.35 AO + midday sun x N.L); "
               "ao (aoMap, channel 1: sun-independent, use with a live directional light for any time of day); "
               "sun (RGB = morning / golden / midday sun visibility, soft 2-degree edge: multiply the directional light by the state's channel).",
        "bake": bake, "nodes": ex.get("lightmapped", {}), "ground_ao": ex.get("ao_only", {}),
        "class_c_and_terrain": "vertex colour COLOR_0 = paint tint x ground-contact AO (multiply; GLTFLoader enables vertexColors)"},
    "lightmapped_meshes": {"how": "compat with the Skymark viewer: texture.colorSpace = SRGBColorSpace; flipY = false; channel = 1; material.lightMap = texture; "
                                  "lightMapIntensity per node", "nodes": {k: {"lightmap": v["lightmap"], "lightMapIntensity": v["lightMapIntensity"], "uv": 1} for k, v in ex.get("lightmapped", {}).items()}},
    "renderer": {"toneMapping": "AgXToneMapping", "toneMappingExposure": 1.0, "outputColorSpace": "srgb", "camera_near": 0.5, "camera_far": 9000,
                 "logarithmicDepthBuffer": True, "note": "road markings sit 12 mm above the asphalt: material road_marking carries polygonOffset in extras"},
    "glass": {"materials": "facade_glass, facade_glass_L04, facade_glass_L06, rail_glass", "recipe": "MeshPhysicalMaterial: color #6d9a98, metalness 0.0, roughness 0.03, "
              "transmission 0 (opaque reflective curtain wall), envMap = the state's rtp_env_*.hdr through PMREM, envMapIntensity 1.0, reflectivity high; "
              "the interior backdrop (rtp_interior_Lnn, emissive) sits 0.9 m behind the glass"},
    "env_maps": {k: {**v, "file": "env/" + v["file"]} for k, v in envl.items()},
    "stills": {k: {"file": "stills/" + os.path.basename(v["file"])[:-4] + ".jpg", "master_png": "airoli-rtp/exterior/" + v["file"], "version": v.get("version", "v2"), "camera_three": {"position": three(v["camera"]["position"]), "target": three(v["camera"]["target"]),
               "lens_mm_36": v["camera"]["lens_mm"]}, "blown_frac": v.get("blown_frac"), "crushed_frac": v.get("crushed_frac"), "seconds": v.get("seconds")} for k, v in stl.items()},
    "cameras": {}, "assumptions": "see airoli-rtp/exterior/NOTES.md and _build/prep/assumptions.json",
}
cams = {}
for k, v in stl.items():
    cn = k.split("_", 1)[1]; c = v["camera"]
    cams[cn] = {"position_three": three(c["position"]), "target_three": three(c["target"]), "lens_mm_36": c["lens_mm"], "hfov_deg": round(math.degrees(2 * math.atan(18 / c["lens_mm"])), 1)}
man["cameras"] = cams
os.makedirs(WEB, exist_ok=True)
for sub in ("stills", "env"): os.makedirs(os.path.join(WEB, sub), exist_ok=True)
import subprocess
for f in glob.glob(os.path.join(WEB, "stills", "*.png")): os.remove(f)
for f in glob.glob(EXT + "/stills/rtp_*.png"):         # web copies as JPEG q90 (the PNG masters stay in exterior/stills)
    subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "90", f, "--out", os.path.join(WEB, "stills", os.path.basename(f)[:-4] + ".jpg")], capture_output=True)
for f in glob.glob(EXT + "/stills/rtp_env_*.hdr"): shutil.copy(f, os.path.join(WEB, "env", os.path.basename(f)))
json.dump(man, open(os.path.join(WEB, "exterior_viewer.json"), "w"), indent=1)
print("wrote", os.path.join(WEB, "exterior_viewer.json"))
