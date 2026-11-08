"""Rendering: Cycles on the GPU at 4K, denoised, with a photographic finish in the compositor.

`configure(quality)`: picks the GPU (OptiX > CUDA > HIP > oneAPI > Metal > CPU), sets samples,
adaptive sampling, light paths, clamping and OIDN denoising (albedo + normal, GPU where it can)
per quality: preview (fast look), final (4K still), ultra (print).
`compositor(spec)`: a subtle photographic finish: bloom on the highlights (the sun in the glass,
signs at dusk), a touch of lens dispersion and vignette, film grain, and the passes written to a
multilayer EXR so the still can be regraded without re-rendering.
`still(path)` / `movie(path_pattern)`: render, and for a move, print the ffmpeg line that makes the mp4.
"""
import os
from .common import *

QUALITY = {
    "preview": dict(samples=48, threshold=0.05, bounces=6, denoise=True, res_pct=50),
    "final":   dict(samples=512, threshold=0.012, bounces=10, denoise=True, res_pct=100),
    "ultra":   dict(samples=1500, threshold=0.006, bounces=12, denoise=True, res_pct=100),
}

def pick_gpu():
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
            try:
                prefs.compute_device_type = kind; prefs.get_devices()
                devs = [d for d in prefs.devices if d.type == kind]
                if devs:
                    for d in prefs.devices: d.use = d.type in (kind, "CPU") if kind != "METAL" else d.type == kind
                    bpy.context.scene.cycles.device = "GPU"; log(f"render device: {kind} ({', '.join(d.name for d in devs)})"); return kind
            except Exception: continue
    except Exception as e: log("gpu probe failed", e)
    bpy.context.scene.cycles.device = "CPU"; log("render device: CPU (no GPU found)"); return "CPU"

def configure(quality="final", spec=None):
    sc = bpy.context.scene
    try: import addon_utils; addon_utils.enable("cycles", default_set=True)
    except Exception: pass
    sc.render.engine = "CYCLES"; cy = sc.cycles; q = QUALITY.get(quality, QUALITY["final"])
    dev = pick_gpu()
    cy.samples = q["samples"]; cy.use_adaptive_sampling = True; cy.adaptive_threshold = q["threshold"]; cy.time_limit = 0
    cy.max_bounces = q["bounces"]; cy.diffuse_bounces = 4; cy.glossy_bounces = 6; cy.transmission_bounces = 10; cy.transparent_max_bounces = 16; cy.volume_bounces = 1
    cy.sample_clamp_direct = 0.0; cy.sample_clamp_indirect = 8.0; cy.caustics_reflective = False; cy.caustics_refractive = False; cy.blur_glossy = 0.5
    cy.use_denoising = q["denoise"]; cy.denoiser = "OPENIMAGEDENOISE"; cy.denoising_prefilter = "ACCURATE"
    try: cy.denoising_input_passes = "RGB_ALBEDO_NORMAL"; cy.denoising_quality = "HIGH"; cy.denoising_use_gpu = dev != "CPU"
    except Exception: pass
    sc.render.resolution_percentage = q["res_pct"]; sc.render.use_persistent_data = True
    sc.render.film_transparent = False; sc.render.use_motion_blur = False
    sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_depth = "16"; sc.render.image_settings.compression = 50
    vl = sc.view_layers[0]
    for p in ("use_pass_z", "use_pass_mist", "use_pass_normal", "use_pass_ambient_occlusion", "use_pass_glossy_direct", "use_pass_emit", "use_pass_cryptomatte_object"):
        try: setattr(vl, p, True)
        except Exception: pass
    log(f"cycles {quality}: {q['samples']} samples, threshold {q['threshold']}, {q['bounces']} bounces, {q['res_pct']}%")

def compositor(spec=None):
    """Bloom, dispersion, vignette. Built for Blender 5.x (compositing node group, sockets for the options) with
    the older scene node tree as fallback. Runs on the CPU: the GPU compositor needs a display library that
    headless machines often lack, and at 4K it costs seconds either way."""
    sc = bpy.context.scene; spec = spec or {}; fx = spec.get("finish", {})
    try: sc.render.compositor_device = "CPU"
    except Exception: pass
    try:
        new_api = hasattr(sc, "compositing_node_group")
        if new_api:
            nt = bpy.data.node_groups.new("av_comp", "CompositorNodeTree")
            nt.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
            n = nt.nodes; rl = n.new("CompositorNodeRLayers"); out = n.new("NodeGroupOutput")
        else:
            sc.use_nodes = True; nt = sc.node_tree; nt.nodes.clear(); n = nt.nodes; rl = n.new("CompositorNodeRLayers"); out = n.new("CompositorNodeComposite")
        def setv(node, name, v):
            if name in node.inputs:
                try: node.inputs[name].default_value = v; return True
                except Exception: return False
            try: setattr(node, name, v); return True
            except Exception: return False
        cur = rl.outputs["Image"]
        g = n.new("CompositorNodeGlare"); setv(g, "Type", "BLOOM") or setv(g, "glare_type", "BLOOM")
        setv(g, "Quality", "HIGH"); setv(g, "Threshold", fx.get("bloom_threshold", 1.6)); setv(g, "Strength", fx.get("bloom", 0.06)); setv(g, "Size", 0.6); setv(g, "Saturation", 1.0)
        nt.links.new(cur, g.inputs["Image"]); cur = g.outputs["Image"]
        ld = n.new("CompositorNodeLensdist"); setv(ld, "Type", "RADIAL"); setv(ld, "Distortion", fx.get("distortion", -0.004)); setv(ld, "Dispersion", fx.get("dispersion", 0.006)); setv(ld, "Fit", True)
        nt.links.new(cur, ld.inputs["Image"]); cur = ld.outputs["Image"]
        # vignette: a soft ellipse, multiplied in lightly
        el = n.new("CompositorNodeEllipseMask"); setv(el, "Size", (1.3, 1.1)); setv(el, "width", 1.3); setv(el, "height", 1.1)
        bl = n.new("CompositorNodeBlur"); setv(bl, "Type", "FAST_GAUSS") or setv(bl, "filter_type", "FAST_GAUSS"); setv(bl, "Size", (0.35, 0.35)) or setv(bl, "Size", 350)
        try: bl.use_relative = True; bl.factor_x = bl.factor_y = 35
        except Exception: pass
        nt.links.new(el.outputs[0], bl.inputs["Image"])
        try: mix = n.new("CompositorNodeMixRGB"); mix.blend_type = "MULTIPLY"; fac, A, B, outp = mix.inputs["Fac"], mix.inputs[1], mix.inputs[2], mix.outputs[0]
        except Exception:
            mix = n.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
            fac = mix.inputs[0]; A = next(i for i in mix.inputs if i.name == "A" and i.type == "RGBA"); B = next(i for i in mix.inputs if i.name == "B" and i.type == "RGBA"); outp = next(o for o in mix.outputs if o.type == "RGBA")
        fac.default_value = fx.get("vignette", 0.18); nt.links.new(cur, A); nt.links.new(bl.outputs[0], B); cur = outp
        nt.links.new(cur, out.inputs[0])
        if new_api: sc.compositing_node_group = nt
        log("compositor: bloom, dispersion, vignette (CPU)")
    except Exception as e:
        log("compositor skipped:", e)
        try:
            if hasattr(sc, "compositing_node_group"): sc.compositing_node_group = None
        except Exception: pass

def still(path):
    sc = bpy.context.scene; os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
    sc.render.filepath = path; log("rendering", path, f"{sc.render.resolution_x}x{sc.render.resolution_y} at {sc.render.resolution_percentage}%")
    bpy.ops.render.render(write_still=True); log("saved", path)

def movie(pattern):
    sc = bpy.context.scene; os.makedirs(os.path.dirname(os.path.abspath(pattern)) or ".", exist_ok=True)
    sc.render.filepath = pattern; log("rendering frames", sc.frame_start, "to", sc.frame_end, "->", pattern)
    bpy.ops.render.render(animation=True)
    log("frames done. Make the film with:\n  ffmpeg -r", sc.render.fps, "-i", pattern + "%04d.png", "-c:v libx264 -crf 17 -pix_fmt yuv420p -movflags +faststart out.mp4")
