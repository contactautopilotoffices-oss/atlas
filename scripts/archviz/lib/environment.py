"""Light: the sky, the sun, the hour, the haze.

`apply(spec, preset)` sets up a world from an HDRI (assets slot hdri.<preset>) with a Sun lamp
aligned to the HDRI's own sun, and turns the whole thing so the sun stands where it really does
over the site at the chosen date and hour (NOAA solar position from the site's latitude and
longitude). Presets: noon, afternoon, golden, dusk, night, overcast. With no HDRI in the library
it builds a Nishita physical sky at the same sun position, with procedural clouds, so the
lighting is physically right either way.

Also: atmospheric haze (a thin volume that softens the far city and separates the hero), the
"lights on" switch for dusk and night (interiors, signs, street lamps), and exposure per preset.
"""
import math, os, datetime
from .common import *
from . import assets

PRESETS = {   # the sun's height that defines the hour (solved per site and date), sun strength, sky strength, exposure, haze
    "noon":      dict(sun_el="max", sun=4.0, sky=1.0, exposure=-0.6, haze=0.006, lights=False),
    "afternoon": dict(sun_el=32.0, sun=3.6, sky=1.0, exposure=-0.4, haze=0.008, lights=False),
    "golden":    dict(sun_el=7.0, sun=2.6, sky=0.9, exposure=0.1, haze=0.012, lights=True),
    "dusk":      dict(sun_el=-4.0, sun=0.0, sky=0.6, exposure=0.8, haze=0.014, lights=True),
    "night":     dict(hour=21.0, sun=0.0, sky=0.15, exposure=1.6, haze=0.01, lights=True),
    "overcast":  dict(sun_el=45.0, sun=0.6, sky=1.2, exposure=-0.2, haze=0.02, lights=False),
}

def hour_for(lat, lng, date, target):
    """The local hour in the afternoon when the sun stands at `target` degrees ("max" for the day's highest)."""
    best, best_h = -99, 12.0
    for i in range(0, 24 * 60, 2):
        h = i / 60; el, _ = solar_position(lat, lng, date, h)
        if el > best: best, best_h = el, h
    if target == "max": return best_h
    h = best_h
    while h < 24:
        el, _ = solar_position(lat, lng, date, h)
        if el <= target: return h
        h += 1 / 60
    return best_h

def solar_position(lat, lng, date, hour_local, tz=5.5):
    """Sun elevation and azimuth (degrees, azimuth clockwise from north) for a date (yyyy-mm-dd) and local hour."""
    y, m, d = (int(v) for v in date.split("-"))
    day = datetime.date(y, m, d).timetuple().tm_yday
    hour_utc = hour_local - tz
    gamma = 2 * math.pi / 365 * (day - 1 + (hour_utc - 12) / 24)
    eqt = 229.18 * (0.000075 + 0.001868 * math.cos(gamma) - 0.032077 * math.sin(gamma) - 0.014615 * math.cos(2 * gamma) - 0.040849 * math.sin(2 * gamma))
    decl = 0.006918 - 0.399912 * math.cos(gamma) + 0.070257 * math.sin(gamma) - 0.006758 * math.cos(2 * gamma) + 0.000907 * math.sin(2 * gamma) - 0.002697 * math.cos(3 * gamma) + 0.00148 * math.sin(3 * gamma)
    tst = hour_utc * 60 + eqt + 4 * lng
    ha = math.radians(tst / 4 - 180)
    la = math.radians(lat)
    cos_z = math.sin(la) * math.sin(decl) + math.cos(la) * math.cos(decl) * math.cos(ha)
    zen = math.acos(clamp(cos_z, -1, 1)); el = 90 - math.degrees(zen)
    az = math.degrees(math.atan2(math.sin(ha), math.cos(ha) * math.sin(la) - math.tan(decl) * math.cos(la))) + 180
    return el, az % 360

def _hdri_sun(image):
    """Where the sun is in an equirectangular HDRI: (azimuth deg from +X of the map, elevation deg), from its brightest texel."""
    small = image.copy(); small.scale(256, 128); px = list(small.pixels)
    best, bi = -1, 0
    for i in range(0, len(px), 4):
        v = px[i] + px[i + 1] + px[i + 2]
        if v > best: best, bi = v, i // 4
    bpy.data.images.remove(small)
    x, y = bi % 256, bi // 256
    return (x / 256) * 360, (y / 128 - 0.5) * 180

def scene_bearing(spec, compass_deg):
    """A compass bearing (clockwise from north) as an angle in the scene (counter-clockwise from +X)."""
    nv = spec.get("north_vector", [0, 1]); north = math.degrees(math.atan2(nv[1], nv[0]))   # where north points in the scene
    return north - compass_deg

def apply(spec, preset="afternoon"):
    P = dict(PRESETS.get(preset, PRESETS["afternoon"])); P.update(spec.get("light", {}).get(preset, {}))
    site = spec["site"]; date = spec.get("date", "2026-11-15")
    if "hour" not in P: P["hour"] = hour_for(site["lat"], site["lng"], date, P["sun_el"])
    el, az = solar_position(site["lat"], site["lng"], date, P["hour"])
    log(f"sun for {date} {P['hour']:.1f}h at {site['lat']:.3f},{site['lng']:.3f}: elevation {el:.1f}, azimuth {az:.0f} (preset {preset})")
    if preset == "night" and el > 0: el = -10
    sc = bpy.context.scene
    w = bpy.data.worlds.new("av_sky"); sc.world = w; w.use_nodes = True; nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld"); bg = nt.nodes.new("ShaderNodeBackground"); bg.inputs["Strength"].default_value = P["sky"]
    sun_scene = scene_bearing(spec, az)
    hdri = assets.resolve(f"hdri.{preset}")
    if hdri:
        env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(hdri)
        tc = nt.nodes.new("ShaderNodeTexCoord"); mp = nt.nodes.new("ShaderNodeMapping"); nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"]); nt.links.new(mp.outputs[0], env.inputs["Vector"])
        haz, hel = _hdri_sun(env.image)
        # turn the map so its sun lands on the real sun's bearing. Blender reads an equirect with u = 1 - theta/360
        # (theta counter-clockwise from +X), so the map's sun sits at theta_s = 360 - haz; the Mapping node's Z
        # rotation moves a map feature from theta_s to theta_s - rot.
        theta_s = 360 - haz; mp.inputs["Rotation"].default_value = (0, 0, math.radians(theta_s - sun_scene))
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
        log(f"HDRI {os.path.basename(hdri)}: its sun {hel:.0f} deg up (the real one {el:.0f}), turned to the site's sun bearing")
        if abs(hel - el) > 15: log("  note: pick an HDRI whose sun height is nearer the hour, or the lamp's shadows and the sky's sun will disagree")
    else:
        sky = nt.nodes.new("ShaderNodeTexSky")
        for t in ("MULTIPLE_SCATTERING", "SINGLE_SCATTERING", "NISHITA"):
            try: sky.sky_type = t; break
            except TypeError: pass
        for k, v in (("sun_disc", False), ("sun_elevation", math.radians(max(0.5, el))),
                     ("sun_rotation", math.radians(sun_scene + 90)), ("air_density", 1.0), ("dust_density", 0.5 if preset in ("noon", "afternoon") else 1.4), ("ozone_density", 2.0), ("altitude", 220.0)):
            try: setattr(sky, k, v)
            except (AttributeError, TypeError): pass
        # clouds: a stretched noise above the horizon mixed over the sky
        tcw = nt.nodes.new("ShaderNodeTexCoord"); mpw = nt.nodes.new("ShaderNodeMapping"); mpw.inputs["Scale"].default_value = (2.2, 2.2, 7.0); nt.links.new(tcw.outputs["Generated"], mpw.inputs["Vector"])
        cl = nt.nodes.new("ShaderNodeTexNoise"); cl.inputs["Scale"].default_value = 3.0; cl.inputs["Detail"].default_value = 8.0; cl.inputs["Roughness"].default_value = 0.62; nt.links.new(mpw.outputs[0], cl.inputs["Vector"])
        cr = nt.nodes.new("ShaderNodeMapRange"); cr.inputs["From Min"].default_value = 0.58; cr.inputs["From Max"].default_value = 0.8; nt.links.new(cl.outputs["Fac"], cr.inputs["Value"])
        sepz = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tcw.outputs["Generated"], sepz.inputs[0])
        hz = nt.nodes.new("ShaderNodeMapRange"); hz.inputs["From Min"].default_value = 0.5; hz.inputs["From Max"].default_value = 0.6; nt.links.new(sepz.outputs["Z"], hz.inputs["Value"])
        mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; nt.links.new(cr.outputs[0], mul.inputs[0]); nt.links.new(hz.outputs[0], mul.inputs[1])
        mixc = nt.nodes.new("ShaderNodeMix"); mixc.data_type = "RGBA"; nt.links.new(mul.outputs[0], mixc.inputs["Factor"]); nt.links.new(sky.outputs[0], mixc.inputs[6])
        mixc.inputs[7].default_value = (5.0, 5.0, 5.3, 1) if preset not in ("dusk", "night") else (0.4, 0.35, 0.4, 1)
        nt.links.new(mixc.outputs[2], bg.inputs["Color"]); bg.inputs["Strength"].default_value = P["sky"] * 0.2
        log("no HDRI in the library: Nishita sky with procedural clouds")
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    # haze: a thin scattering volume the far city sinks into. Bounded (a 5 km box, 350 m tall), never a world
    # volume: in Cycles a world volume reaches to infinity and swallows the sky and the sun's shadow rays.
    if P["haze"] > 0:
        for o in [o for o in bpy.data.objects if o.name.startswith("av_haze")]: bpy.data.objects.remove(o)
        hm, hnt, hout = new_material("av_haze"); vol = N(hnt, "ShaderNodeVolumeScatter"); vol.inputs["Density"].default_value = P["haze"] * 0.004; vol.inputs["Anisotropy"].default_value = 0.65
        try: vol.inputs["Color"].default_value = (0.8, 0.85, 0.95, 1)
        except Exception: pass
        L(hnt, vol.outputs[0], hout.inputs["Volume"])
        hb = box("av_haze", (-2500, -2500, -2), (2500, 2500, 350), hm); hb.display_type = "WIRE"
    # the sun lamp, aligned
    for o in [o for o in bpy.data.objects if o.type == "LIGHT" and o.data.type == "SUN"]: bpy.data.objects.remove(o)
    if P["sun"] > 0 and el > 0:
        sd = bpy.data.lights.new("av_sun", "SUN"); sd.energy = P["sun"]; sd.angle = math.radians(0.53)
        warm = clamp((25 - el) / 25, 0, 1); sd.color = (1.0, 1.0 - 0.12 * warm, 1.0 - 0.35 * warm)
        sun = bpy.data.objects.new("av_sun", sd); sc.collection.objects.link(sun)
        d = Vector((math.cos(math.radians(sun_scene)) * math.cos(math.radians(el)), math.sin(math.radians(sun_scene)) * math.cos(math.radians(el)), math.sin(math.radians(el))))
        sun.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    sc.view_settings.view_transform = "AgX"
    for look in ("AgX - Medium High Contrast", "Medium High Contrast", "None"):
        try: sc.view_settings.look = look; break
        except TypeError: pass
    sc.view_settings.exposure = P["exposure"] + float(spec.get("exposure_offset", 0.0))
    try: sc.cycles.film_exposure = 1.0
    except Exception: pass
    return P

def lights_on(on=True, head=(1.45, 0.0, 6.8)):
    """Street lamps for golden hour, dusk and night: a warm point light at the head of every lamp instance (the
    entourage places lamps as collection instances; `head` is the head's offset in the lamp's own frame). Interior
    light and signs are already emissive through the materials."""
    if not on: return
    n = 0; off = Vector(head)
    for e in [o for o in bpy.data.objects if o.name.startswith("av_lamp_") and o.instance_collection is not None][:80]:
        c = e.matrix_world @ off
        ld = bpy.data.lights.new("av_lamp_light", "POINT"); ld.energy = 1200; ld.color = (1.0, 0.8, 0.55); ld.shadow_soft_size = 0.3
        lo = bpy.data.objects.new("av_lamp_light", ld); lo.location = c - Vector((0, 0, 0.35)); bpy.context.scene.collection.objects.link(lo); n += 1
    log(f"lights on: {n} street lamps lit")
