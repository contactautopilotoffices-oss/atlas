"""What the camera sees of the sky (diorama.py --sky-mode physical).

The Poly Haven HDRIs are photographs taken at real places: a bridge railing, a car park and a fence sit on their
horizons. They light the scene well, but a camera must never see them. So camera rays and glossy rays (reflections in
the glass) see Blender's physical sky, with the sun at the computed solar position. Every other ray (diffuse bounce,
transmission, shadows) still takes the HDRI's light. The result is a clean, physically right sky gradient
(sunrise, sunset, blue hour) with no foreign objects.
"""
import math
import bpy

def setup(sc, ctx):
    az, el = ctx["az"], ctx["el"]
    w = sc.world; nt = w.node_tree; bg = nt.nodes["Background"]
    hdr_link = bg.inputs[0].links[0].from_socket if bg.inputs[0].links else None
    sky = nt.nodes.new("ShaderNodeTexSky")
    for t in ("MULTIPLE_SCATTERING", "NISHITA"):
        try: sky.sky_type = t; break
        except Exception: pass
    # sun_rotation measured with a lit cube: 0 puts the sun in the north, 90 in the east (the compass bearing)
    for k, v in (("sun_elevation", math.radians(el)), ("sun_rotation", math.radians(az)), ("altitude", 40.0),
                 ("air_density", 1.0), ("aerosol_density", 1.6 if el > 0 else 1.0), ("ozone_density", 1.0),
                 ("sun_disc", True), ("sun_size", math.radians(0.6)), ("sun_intensity", 0.35)):
        try: setattr(sky, k, v)
        except Exception: pass
    lp = nt.nodes.new("ShaderNodeLightPath")
    mx = nt.nodes.new("ShaderNodeMath"); mx.operation = "MAXIMUM"
    nt.links.new(lp.outputs["Is Camera Ray"], mx.inputs[0]); nt.links.new(lp.outputs["Is Glossy Ray"], mx.inputs[1])
    # the physical sky is far brighter than the HDRI; scale it to sit with the scene's exposure
    k = ctx["A"][ctx["A"].index("--sky-cam") + 1] if "--sky-cam" in ctx["A"] else ("0.012" if el > 2 else "0.03")
    sc_ = nt.nodes.new("ShaderNodeMixRGB"); sc_.blend_type = "MULTIPLY"; sc_.inputs[0].default_value = 1.0
    sc_.inputs[2].default_value = (float(k),) * 3 + (1,)
    nt.links.new(sky.outputs[0], sc_.inputs[1])
    # the HDRI's strength is on the Background node; divide it out for camera rays so the sky's level is set only by --sky-cam
    s = bg.inputs[1].default_value
    if s > 0: sc_.inputs[2].default_value = (float(k) / s,) * 3 + (1,)
    mix = nt.nodes.new("ShaderNodeMixRGB"); nt.links.new(mx.outputs[0], mix.inputs[0])
    if hdr_link: nt.links.new(hdr_link, mix.inputs[1])
    nt.links.new(sc_.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], bg.inputs[0])
    print("sky: camera and glossy rays see the physical sky (sun az %.0f, el %.1f), level %s; HDRI lights the rest" % (az, el, k))
