---
name: archviz-blender-photorealism
description: How to make Blender (Cycles) renders read as photographs, learned from the YouTube playlist "How to Achieve Realism in 3D" (7 videos, on realism, imperfections, compositing into real photos, dust in sunbeams, fire, glass and 10 photorealism tips), and from rendering Volt's conference room at Skymark F-1 in this repo. Use whenever an interior, exterior or product still or film is rendered in Blender, when a 3D page needs a "real" picture instead of a browser model, or when a render looks CG and you need to know why.
---

# Blender photorealism

Read `archviz-quality-bar` first. That skill says what world class looks like.
This one says how to get Blender to produce it.

## The rule that matters most

**Browser 3D (three.js) is for getting somewhere. Blender Cycles is for the
picture the client looks at.** Our three.js floor at /skymark looked like
boxes in a fake sky, and no amount of tuning fixes that. The same plan,
rendered in Cycles with real light bounce, looks like the deck's renders at the
first attempt. So any room or view a client will judge goes through Blender and
is shown as a full-screen still (or a short film), with the 3D only as the map
around it.

## Running Blender here (cloud session, no GPU)

- **Install.** Blender is not installed, and download.blender.org is blocked.
  Blender ships on PyPI as `bpy` (with Cycles and OpenImageDenoise):
  `python3 -m venv bl && bl/bin/pip install bpy==5.2.3` (a cp313 wheel, which
  matches the container's Python).
- **Cycles is an add-on** and must be turned on in the script:
  `addon_utils.enable("cycles", default_set=True)`. The CUDA warning only means
  there's no GPU, and CPU is fine.
- **Speed (4 cores).** 960x540 at 24 samples with denoise takes about 40 s, a
  good preview. 1920x1080 at 160 samples takes about 15 min.
- **meshopt.** The importer here can't read meshopt-compressed GLBs, which
  is what `gltf-transform optimize` produces for the web. Keep the uncompressed
  original of every model (Meshy's download, `context.py`'s output) for Blender.
- **Never use `bpy.ops` transform_apply in a build script.** It acts on
  every selected object, and duplicated objects stay selected. Transform the
  mesh data instead (`mesh.transform(Matrix)`).
- **Asset sites are blocked** (Poly Haven, ambientCG, Sketchfab, BlenderKit).
  So skies come from Blender's physical sky, materials are procedural, and
  furniture comes from Meshy (`scripts/skymark/meshy.py`, CC BY 4.0 on the free
  plan). If the user can allow `dl.polyhaven.org`, use real HDRIs and scanned
  textures, which the playlist says beats anything procedural.

## What the playlist teaches, and how we apply it

1. **Light it the way it would really be lit** (video 1).
   - An HDRI or physical sky, plus the real fixtures, is the whole rig. Block
     light with planes where a wall or a building would block it.
   - **No light linking.** Lights that touch only some objects break the light
     ratio, and the eye notices even when it can't say why.
   - For interiors: sun and sky through the real facade, then downlights,
     cove and pendant at their real positions and colour temperatures (about
     4000 K for task light, 3000 K for the cove).
2. **Exposure like a camera** (video 7).
   - The physical sky is far too bright on purpose. Turn the sky strength
     down (about 0.12 here) and set the exposure, rather than dimming the
     scene's own lights.
   - Use AgX with the Medium High Contrast look.
3. **Imperfections, in the right channel** (video 1).
   - Scratches and dents go in bump, normal or displacement.
   - Fingerprints, smudges and wear go in roughness.
   - Roughness must vary across every surface. Our `principled()` helper drives
     roughness ±15% from a noise.
   - Arrange things the way people leave them, not on a grid. Chairs are pulled
     out by different amounts and turned up to 9 degrees, blinds hang at
     different heights, and notepads and pens sit at angles.
4. **Real detail from reference photos** (videos 1 and 2).
   - Model what a photo of the real thing shows: cable flaps in the table,
     handles on the glass door, the frosted band on the partition, the cove
     lip that hides the LED strip, the T-bar grid in the ceiling tiles.
   - Video 2 builds a whole shopfront from one phone photo. A photo projected
     onto simple geometry beats a perfect procedural material.
5. **Image textures beat procedural for realism** (video 7). Use photographed
   textures whenever we can get them. When we can't, procedural is fine for
   carpet, paint, ceiling tiles and wood at room scale. Never let it be
   obviously tiling or perfectly uniform.
6. **Edges catch light.** Bevel every hard edge (2 to 6 mm). A box with
   no bevel is the first thing that reads as CG.
7. **Depth of field, but only as much as a real lens** (videos 1 and 7). For
   architecture, use f/8 focused on the subject, enough to soften the far end.
   Never make it look like a miniature.
8. **Glass** (video 6's subject; its transcript was not available here).
   - For window and partition glass, a single thin pane: a fresnel mix of
     transparent and glossy, fully transparent to shadow rays (`LightPath > Is
     Shadow Ray`), so sun and sky reach the room without caustic noise.
   - Real thickness (a Glass BSDF) only for objects: bottles and tumblers.
   - Frosted film: mix in a little translucency (0.16). Above about 0.3 it
     reads as a solid white panel.
9. **Composite into real photographs** (video 3).
   - Match the photo's camera (fSpy, or the known lens and height). Use a
     shadow catcher shaped like the real ground or ledge.
   - Find the sky or HDRI that matches the photo's highlights and shadows,
     using a grey sphere as a probe.
   - Then match blacks, whites and saturation with levels and hue/saturation.
   - For Autopilot this means **our building or fit-out rendered into a real
     photo of the site** (a Street View frame, a photo from the client). It's
     the fastest way to "the real building".
10. **Dust in sunbeams** (video 4).
    - A few thousand tiny particles in the sun shafts make a room feel lived
      in.
    - Make them translucent, not emissive, so only those in the beam show.
    - Add a few long "hairs" for variety, and keep it subtle.
11. **Fire, screens, anything that moves light** (video 5).
    - Real footage on a plane, with emission added onto transparency and
      shadows off, beats a simulation. Use it for a fireplace, a lobby video
      wall or a lit sign.
    - Our screens show a real slide from the deck as emission, with a fresnel
      gloss on top.
12. **Post, lightly** (videos 1, 3 and 7).
    - Save EXR (or 16 bit) when grading.
    - Add a very small blur (about 0.3 px) and fine grain, so it isn't
      razor-CG.
    - Glare only on lights that really glow.
    - No pure black, no pure white, no fully saturated colour.
13. **Be careful with people, animals and plants** (video 7).
    - Bad ones ruin a good render. Use the best models available or leave
      them out.
    - Our first attempt at street trees, displaced spheres, looked so bad it
      was removed. A plant has to be a real model or not there at all.
14. **Don't show everything** (video 7). Frame the shot so what's in it is
    finished. A tight, well-lit view beats a wide one with weak corners.

## The three forces: models, lighting, camera

From a talk on photo-scanning and realism that the user shared (Nov 2026).
A shot reads as real only when all three are right. Scan quality depends on
the same three things.

**Models.**
- The best detail comes from a real object, photo-scanned: Kiri, Polycam or
  a phone photogrammetry app. A scan records small blemishes and wear, and
  that is the difference between CG and real.
- Scan rules:
  - pick an object with plenty of features (shape and colour detail);
  - put it on a plain, lightly textured base with no clutter around it;
  - shoot in soft, even light: an overcast day outdoors, or a bright room
    out of direct sun. Hard sun bakes contrast into the texture;
  - keep the overlap between photos high and the camera steady, or put the
    object on a turntable and the phone on a stand;
  - turn auto object masking on;
  - for plain objects with few features, use a video-based neural scan.
- For a fit-out like Volt, ask the site team to scan one of each repeated
  item (task chair, desk, planter, lounge chair). One good scan, instanced
  at every CAD position, beats any number of modelled chairs.

**Lighting.**
- First, decide what lies outside the frame: the windows, time of day,
  weather and which fixtures are on. Then light for that world.
- Aim for the best-looking light that is still believable. One light alone
  is rarely enough.
- The recipe:
  - an HDRI at low strength, for coloured fill only;
  - an area light as the key, with a gobo (blinds or leaves) where it fits;
  - a second, soft area light to open up the shadows;
  - bounce planes or objects for extra light and reflections;
  - optionally, a cube with Volume Scatter at very low density and high
    anisotropy (about 0.7 to 0.9), so the window light shows a little haze.
- Always light against a reference photo, and keep going back to it.

**Camera.**
- Decide what took the picture: a phone snap, a DSLR shot or an old video
  camera. Then match that camera's lens and sensor: focal length, depth of
  field, grain, vignette, bloom and distortion.
- Add the imperfections in the compositor:
  - vignette: an ellipse mask, blurred, mixed with Alpha Over;
  - grain: a noise texture mixed in at the pixel scale;
  - lens distortion: a node at the end of the tree, at a very low value,
    or it looks fake.
- For our interiors, copy the deck renders: a 20 to 24 mm lens at about
  1.5 m eye height, verticals kept straight, a light vignette and fine
  grain.

## The pipeline in this repo

- `scripts/skymark/blender/conf18.py`: builds a room from
  `scripts/skymark/volt-floor1.json` at true size. It sets up the shell,
  facade, partition, ceiling, lights, table, Meshy chairs, props, the real
  Sector 6 context outside (`context.glb`, placed with the same building frame
  as `engine/skymark.js`) and the camera, then renders.
- Arguments: `--samples`, `--res`, `--exposure`, `--sun`, `--sky`,
  `--sun-el`, `--sun-az`, `--lens`, `--cx/--cy` (camera) and `--tx/--ty`
  (target).
- Output goes to `media/skymark-f1/renders/<room>.jpg`. `scripts/skymark/build.js`
  lists every render that exists, and the page opens it full screen when
  the room is clicked, with "Our render | The deck's | 3D" to compare.

## Before showing a render, check

- Does it read as a photo at a glance on a phone? If any one thing says "3D",
  fix that thing first (it's usually an unbevelled edge, uniform roughness,
  a bad plant, or glass that's too white).
- Are the real sizes right (table 750 mm high, door handle 1 m, ceiling
  2.7 m)?
- Do the room and its furniture match the plan and the deck's legend?
- Is the light believable? It should come from the windows and the fixtures,
  nothing lit that couldn't be.
- Is the view out of the window the real neighbourhood, not a void?
- Put it next to the deck's render of the same room. Is it at least as good?
