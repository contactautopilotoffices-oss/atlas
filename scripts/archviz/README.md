# Archviz finish: from our builders' scenes to 4K photoreal renders

This is the layer a Blender expert adds by hand before a final render, written down so it runs
the same way every time, on any of our buildings. It takes a scene one of our builders made
(the Skymark exterior, an Andheri diorama, the 723 Avenue hero) and does, in order:

| Step | What it does | Where |
| :- | :- | :- |
| city | Rebuilds the district from the Overture scene with real facade depth near the camera: recessed windows with sills and dark glass, slab lines, parapets, roof tanks and AC units; warm cream, sand, terracotta, grey and ochre finishes; asphalt, pavers, grass, water laid as real surfaces | `lib/city.py` |
| materials | Swaps every builder material for a finished PBR one: texture sets at true scale (albedo, roughness, normal, displacement), box-projected so nothing needs UVs; roughness variation; a Bevel node on every hard edge (5 to 15 mm); AO grime, rain streaks and base darkening; low-e curtain glass with Fresnel, tint, per-pane normal jitter and dust; lit interiors behind glass; emissive signs and ceiling panels at plausible strengths | `lib/materials.py` |
| vegetation | Removes the builders' proxy planting and puts asset trees, palms and hedges at the same spots, instanced with geometry nodes (random pick, yaw, scale, lean); scatters grass clumps on every lawn | `lib/vegetation.py` |
| entourage | Cars along the diorama's lanes in their direction, parked cars, people at the entrance and on the footpaths, lamp posts, benches, bins; all instanced | `lib/entourage.py` |
| light | HDRI sky (or a Nishita physical sky when none is in the library) with a Sun lamp aligned to it, turned so the sun stands where it really does over the site on the date at the preset's hour, solved from the sun's height: noon, afternoon (32 deg), golden (7 deg), dusk (4 deg below), night, overcast. Bounded haze. Lamps on after golden hour. AgX, exposure per preset | `lib/environment.py` |
| camera | The shot list from `archviz-facade-detail`: street (24 mm, eye level, verticals corrected), corner, three_quarter, aerial, drone, detail (85 mm f/2.8), interior; and moves: orbit, flydown, dolly | `lib/camera.py` |
| render | Cycles on the GPU (OptiX, CUDA, HIP, oneAPI or Metal, whichever is there), adaptive sampling, OIDN with albedo and normal, light paths and clamping per quality; compositor finish on the CPU: bloom, a touch of dispersion, vignette; passes on for regrading | `lib/render.py` |

Nothing in it needs a paid add-on. Assets come from Poly Haven (CC0) through `fetch`, or from
your own library (Quixel, Botaniq, Graswald, BlenderKit, Sketchfab) by pointing a manifest
slot at a file. Every slot is optional: with an empty library it still renders, from procedural
materials and built-in proxies with real leaf geometry, and it gets better as the library fills.

## Run it

Blender 4.2 or newer (built and tested on 5.2). From the repo root:

```bash
# 1. the sources (once)
blender -b -P scripts/skymark/blender/exterior.py -- --save build/skymark.blend --context build/context_raw.glb
npx -y @gltf-transform/cli@4 copy media/skymark-f1/context.glb build/context_raw.glb      # Blender cannot read meshopt
python scripts/world/prep.py <skydata> build/noida/scene.json build/noida/world.json --region scripts/world/regions/noida-skymark.json

# 2. the library (once, needs the internet; blocked in the cloud session)
blender -b -P scripts/archviz/finish.py -- fetch                 # HDRIs, textures, trees, props from Poly Haven
#    then drop your own palms, cars and people into scripts/archviz/assets/library/ and point the manifest at them

# 3. a still
blender -b -P scripts/archviz/finish.py -- --project scripts/archviz/specs/skymark.json --shot three_quarter --preset golden --quality final --out renders/skymark/3q-golden.png

# a move (300 frames, then ffmpeg prints the mp4 line)
blender -b -P scripts/archviz/finish.py -- --project scripts/archviz/specs/skymark.json --move flydown --frames 300 --quality final --out renders/skymark/fly/

# the finished scene, to open in Blender and work on by hand
blender -b -P scripts/archviz/finish.py -- --project scripts/archviz/specs/skymark.json --shot street --save build/skymark-finished.blend --no-render
```

For 723 Avenue (an Andheri diorama): uncompress the GLB
(`npx -y @gltf-transform/cli@4 copy media/flipkart-andheri/world/d/723-avenue.glb build/723-avenue.glb`),
build the Andheri scene with `prep.py` into `build/andheri/scene.json`, then run with
`--project scripts/archviz/specs/723-avenue.json`. Any other option is the same spec with its id,
GLB and JSON.

Options: `--preset noon|afternoon|golden|dusk|night|overcast`, `--quality preview|final|ultra`,
`--res 3840x2160`, `--wet 0.6` (puddles after rain), `--no-city --no-materials --no-vegetation
--no-entourage` to skip a step, `--save`, `--no-render`.

## Times (reference)

On a 4-core CPU with no GPU, a 480x270 preview with 48 samples takes 30 s. At 4K and 512
samples on the CPU it would take hours; on an RTX 4070 class GPU (OptiX) expect 2 to 5 minutes
a frame at `final`, 8 to 15 at `ultra`. A 300-frame flydown at 4K is an overnight job on one
GPU; render the move at 1080p for review first (`--res 1920x1080 --quality preview`).

## The spec

`specs/<id>.json`: the source (`blend` or `glb` + diorama `json`), the site (lat, lng), the date,
`north_vector` (where north points in the scene's xy, for the sun), the hero's object prefixes,
front direction and `floor1_z`, the city (Overture scene, where the hero sits in it, and the frame
turn), planting and entourage you add by hand, light overrides per preset, finish strengths and
shot overrides (position, target, lens, shift, f_stop). Skymark's and 723 Avenue's are there.

## The library

`assets/manifest.json` lists the slots. `fetch` fills the Poly Haven ones; `local` ones you supply.
What matters most for the photo read, in order: an HDRI per preset (the sky and its reflections
in the glass), trees with real branches (Poly Haven's are good; palms need a Botaniq or Sketchfab
model), a few scanned people and real cars (Renderpeople free, Mixamo, BlenderKit), then the
texture sets.

## Checks before you show it (archviz-quality-bar)

- Hard edges catch light (the bevel node), glass shows the sky and something lit inside, panels
  have joints, walls have grime where water runs.
- The sun is where it is at that hour over that site, long shadows at golden hour, lamps on after.
- Verticals are vertical in the street shots (the shots use lens shift, not tilt).
- The city round the hero sits in the hero's palette and reads as a real district from above,
  with windows cut in, not painted.
- People at the entrance, cars on the road, trees with leaves you can count.

## Known limits

- The Random Value and compositor nodes changed between Blender 4.x and 5.x; both are handled,
  other versions may need a socket name adjusted.
- Proxy trees (no asset) are leaf clouds, not branched trees. They read well at 30 m and beyond.
- The city's near ring assumes office and residential blocks; sheds and chawls get the same
  window grid.
- Night: street lamps and interiors are lit; facade accent lighting (coves, uplights) is not
  modelled, add it in the spec's entourage or by hand in the saved scene.
