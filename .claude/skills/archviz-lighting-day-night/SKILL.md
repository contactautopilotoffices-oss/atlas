---
name: archviz-lighting-day-night
description: How to light a building from noon through golden hour and dusk to night, with thousands of individually lit windows, facade accent lighting and a time-of-day and cloud control, learned from the reference video "Lighting mapping and daylight to sunlight transition" (a curved waterfront residential pair under Vancore Light Control). Use for any render or real-time view where the sun, sky, time of day, night lighting, window lights or a light-control slider matters.
---

# Lighting: daylight to night

Read `archviz-quality-bar` first.

## What the reference does (Vancore Light Control)

- **Day:**
  - the two towers have white curved slab bands and blue-grey glass, under
    a soft overcast to clear sky;
  - the sun is high and to the side, so the curved slab edges grade from
    lit to shadow;
  - palms and planting sit at the base, with water in front.
- **The transition:**
  - a time-of-day slider and a cloud-coverage slider in a small card
    (Arabic UI here) drive the whole scene;
  - the sky goes from blue to dusk to deep navy, and the ambient light drops
    and cools;
  - the windows switch on progressively, not all at once.
- **Night:**
  - each window is its own warm interior (2700 to 3200 K), with different
    brightnesses, some curtains, some rooms off;
  - the amenity floor (a lit bar or gym) is brighter and more colourful;
  - slab edges catch a faint uplight, and the water reflects the facade;
  - the sky keeps some colour (it is never pure black).
- **Branding:** the tool is named "Light Control" and sells the glow ("the
  perfect glow breathes life into your design").

## How we build it

**Sun and sky (Blender)**
- Use a physical sky (Nishita or multiple scattering) with the sun from real
  solar position (latitude, date, time). Drive the sky's sun elevation and
  rotation and the sun lamp from one controller (a driver on an Empty, or a
  Python handler), so they never disagree.
- Golden hour: sun elevation 3 to 12 degrees, a warm sun (around 3500 K),
  sun angle 0.5 to 1 degree for crisp but soft shadows, strong sky bounce.
- Clouds: an HDRI with clouds rotated so the sun matches, or a procedural
  volumetric cloud shell. Coverage maps to a 0 to 1 control that lowers sun
  strength and raises sky diffuse.
- Colour management: AgX (Medium High Contrast for day, Base for night).
  Expose per state; night needs +1.5 to +3 stops over day.

**Windows at night**
- Give every window (or every room module) an interior emission driven by
  a random value per window: Object Info random for instanced modules, or a
  hashed cell id from position for a facade mesh.
  - About 40 to 70 percent on at 9 pm, fewer after midnight. Animate the
    threshold with time.
  - Colour varies between 2700 K and 4000 K. Brightness varies by 0.5 to
    1.5x.
  - About 10 percent are curtained: a dimmer, flat warm colour.
- Interiors behind lit windows: interior mapping, or a modelled ceiling with
  a light, so the glow has depth (a ceiling, a back wall). A flat emissive
  pane reads as a light box.
- Facade lighting: linear LED uplights on fins and slab edges (emissive
  strips, or spot lights with IES profiles), soffit downlights on balconies,
  podium signage, and landscape uplights on palms.
- Night sky: deep blue (not black), with a slight city glow at the horizon.
  Keep a moon or sky fill so the facade form still reads.

**Transitions**
- Interpolate everything from one time value: sun angle, sky, exposure,
  window threshold, facade light strength and fog colour. On the web, lerp
  key states (night, twilight, golden, day, noon) and switch windows on
  per window with a hashed threshold, so they come on one by one. Avoid a
  global fade.
- Re-bake reflections or the environment only when the time changes
  meaningfully.

**Real-time (three.js)**
- Use an HDRI environment (PMREM) matching the sun, a directional sun with
  soft shadows, and baked AO or lightmaps from Cycles for the hero building.
- Window emission in the facade shader from a per-window hash, tinted by
  colour temperature, plus bloom at night (threshold just under 1).
- Present the controls as a time slider and a cloud slider in one small
  card, like the reference. The weather controls we removed failed because
  they ran without baked light and looked flat. Bring them back only with
  this lighting.

## Checklist

- [ ] The sun, the sky and the shadows agree at every time.
- [ ] Windows light individually, with variation in colour and brightness,
  and with depth behind them.
- [ ] Facade accent lights and landscape lights come on at dusk.
- [ ] The night sky has colour and the form still reads.
- [ ] One time value drives everything, and the transition is smooth.
