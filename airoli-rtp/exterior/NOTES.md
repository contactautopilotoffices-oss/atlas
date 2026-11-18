# Reliable Tech Park: exterior twin, build notes

Worker notes for the overnight exterior build (19 Nov 2026). Plain English; every number here comes from a log
in `_build/` or `checks.json`. The founder's open questions are at the end.

## How to rebuild (headless, Blender 5.2.3)

```
V=<scratchpad>/venv/bin/python   S=<scratchpad>/rtp   B=/Applications/Blender.app/Contents/MacOS/Blender
$V -I tools/prep_data.py $S _build/prep            # CAD + Overture + OSM + DSM -> prep.json, terrain.npz, assumptions.json
$V -I tools/textures.py _build/tex 1.368           # procedural, tileable, true-scale textures (no satellite imagery)
$B -b --factory-startup --python tools/build_exterior.py                       # -> _build/rtp_exterior.blend (no Cycles)
tools/locked.sh $B -b _build/rtp_exterior.blend --python tools/bake_export_ext.py -- --stage bake
$B -b _build/rtp_exterior_baked.blend --python tools/bake_export_ext.py -- --stage export
tools/locked.sh $B -b _build/rtp_exterior.blend --python tools/render_exterior.py -- --mode stills --samples 192
tools/locked.sh $B -b _build/rtp_exterior.blend --python tools/render_exterior.py -- --mode env --states morning,night --res 2048x1024 --samples 64 --sun-lamp 0
$B -b _build/rtp_exterior_baked.blend --python tools/checks_dump.py && $V -I tools/checks.py
python3 tools/write_viewer_json.py
```

`tools/locked.sh` takes the shared render lock (`~/.cache/atlas-blender-render.lock`), so only one Cycles job runs on the Mac.

## What is built

- **RTP** from the 4th-floor CAD shell (cluster 10), registered to `rtp_local` with `frames.json` (`rtp4-shell`).
  Slab edge = outer outline of every facade layer; glass line = outline of the STRUCTURAL GLAZING / ASSEMBLY / fins / walls,
  kept at least 0.15 m inside the slab edge. Per floor (collection and parent node `rtp_L00` .. `rtp_L09`, `rtp_ROOF`):
  slab, 0.85 m ACP band (50 mm proud), glass ribbon, mullions on a 1.368 m module, RCC fins and ribs, round columns of the
  court-side colonnade, an emissive office backdrop 0.9 m behind the glass, terrace balustrades on the stepped ends.
- **Context (520 m)**: 1,962 Class C and 6 Class B buildings from Overture, roads at OSM-class widths with kerbs
  (black-and-yellow painted), footpaths, lane markings, the Thane-Belapur median, the railway (ballast, 4 rails,
  catenary masts), ground partitioned by land use (no overlaps), trees and palms, street lamps, cars, buses, the
  substation with 12 pylons and lines, the pond.
- **Terrain** to 3.2 km from Copernicus GLO-30 (both tiles), buildings removed with a 150 m minimum filter.

## Assumptions

All are logged with their reasons in `_build/prep/assumptions.json` (copied into `checks.json`). The ones that matter:

- **floors**: G + 9 (levels 0-9), floor-to-floor 3.6 m, ground FFL +0.6 m, roof slab at +36.6 m, parapet to +37.8 m, drum tops ~42.6 m, dome apex ~46.5 m. Evidence: the brief's Overture dsm_excess for RTP is 47.7 m, which matches roof + drums + dome for G + 9 (G + 8 would top out near 43 m). But the raw Copernicus DSM, read here directly, peaks at only ~22 m over RTP (about 10 m above the surrounding ground): the 30 m radar pixels smear the building, or the 2011-15 survey predates parts of it, so the DSM alone cannot fix the count. Photos show 8-9 ribbons. G + 9 kept, as the brief says, pending the landlord's section drawing.
- **terraces**: The rounded ends (south end of the east arm beyond y < 0.7, west end of the north arm beyond x < -40.7) step back 3.5 m at level 8 and 7.0 m at level 9 (from photos: stacked terraces near the top). Terraces get a 1.1 m glass balustrade.
- **lobby**: Main lobby at the inner corner (15.5, 82.8): the CAD slab outline is square there, so the photos' chamfer is modelled as a double-height glass lobby (levels 0-1) filling the corner with a 45-degree face (9 m legs) toward the south-west court, and an entrance canopy at +4.8 m projecting further into the court.
- **mullions**: Curtain-wall module = structural bay 6.84 m (median vertex spacing of the STRUCTURAL ASSEMBLY polylines) split into 5 panels = 1.368 m; mullions 60 x 140 mm, 76 mm proud of the glass; no transoms (structural glazing reads as flush ribbons).
- **spine**: The 'central grey vertical spine with ribbed elements' of the photos is placed on the court-side bulge of the east arm (y 27.5-52.5 m, where Core 1/2 meet the facade): grey ACP piers 0.3 m deep every 1.2 m, running through all floors.
- **roof**: Two roof drums (radius 6.5 m, 6 m tall) centred on the two rounded ends; the white dome (6.5 m radius, 0.6 rise ratio) is on the south drum; the red RELIABLE sign with a white R logo wraps the west drum, facing south-south-west (court and Thane-Belapur Road). Positions are from photo reading, not drawings.
- **terrain**: Ground model = Copernicus DSM opened with a 150 m minimum filter (removes buildings) and smoothed; hills kept where the surface rises > 25 m over 210 m. Relative to the site ground (11.6 m). Flat inside 560 m (the detailed context disc), blended to the real relief by 1000 m, so the Parsik hills east of the site form the skyline. The second tile (N19 E072, west of 73.0 E) was fetched from the public Copernicus bucket.
- **class_b**: Overture/OSM name only Liberty Tower (10 floors) and Empire Tower near the site. Sutherland is given to the large unnamed slab block west of RTP (BSV could not be placed: only one free slab block of that size exists west of RTP besides Liberty Tower, so it is not labelled); Lumina CloudInfra DC to the bulkiest low building within 200 m and Gramercy to the tallest remaining one (Clover not placed: no further large building within 200 m). These positions are NOT verified and must be checked against the client's site list. Class B: Liberty Tower at (-144,15) h 37.2 m [OSM building:levels], glass; Empire Tower at (-29,268) h 37.2 m [Overture dsm_excess 37.3 m], glass; Liberty Tower annexe at (-155,-35) h 15.6 m [assumed (no usable height in the open data)], glass; Sutherland (assumed position) at (-211,23) h 22.8 m [assumed (no usable height in the open data)], glass; Gramercy Techpark (assumed position) at (199,-130) h 15.6 m [assumed (no usable height in the open data)], glass; Lumina CloudInfra DC (assumed position) at (-153,-146) h 15.6 m [assumed (no usable height in the open data)], industrial
- **car_park**: The multi-level car park with a louvred facade under a glass tower is modelled as a 4-level perforated-metal podium under Liberty Tower (the tallest Class B building, 37.2 m). Which neighbour it really is, is not in the open data.
- **roads**: Road widths by OSM class: primary carriageway 9.5 m (3 lanes) per direction, secondary 12 m, tertiary 9 m, residential 6 m, living street 4.5 m, service 5 m. Thane-Belapur Road's two one-way carriageways get a planted median where they run within 26 m of each other. Footpaths 2.5 m with 150 mm kerbs on primary/secondary/tertiary roads, 1.5 m elsewhere.
- **court**: The court inside the L is paved surface parking around a landscaped lawn (the Overture 'playground' polygon), palms along the lawn edge; parking bays 2.5 x 5 m on the paved part. Layout is assumed (no site plan).
- **substation_pond**: OSM here has no power or water tags. The 220 kV Kalwa substation is placed as a 120 x 90 m switchyard on the nearest free ground west of Thane-Belapur Road (centre (-536, 165)); the pond as a 72 x 46 m pond on free ground to the north-west (centre (-150, 163)). Both positions are illustrative and must be checked.
- **props**: Trees are scattered by land use (no OSM tree data here), avenue trees every 14 m on major footpaths, palms on the court, the median and the RTP frontage. Moving traffic on Thane-Belapur Road (1 vehicle per 38 m per carriageway, 22 % buses), parked cars in 75 % of the court bays.
- **sun**: Sun positions computed (NOAA algorithm) for 19 Nov 2026 IST at 19.1692 N 73.0018 E. Sunset that day is ~18:00 IST, so the plan's 18:45 blue hour is taken at 18:15 and night at 20:30. morning 09:30: az 129.84, el 32.62; midday 13:00: az 193.61, el 50.33; golden 17:45: az 248.44, el 2.48; blue_hour 18:15: az 250.85, el -4.43; night 20:30: az 259.15, el -35.24
- **lighting**: physical multiple-scattering sky (Blender) with sun disc; aerial perspective from a homogeneous scattering box 7 x 7 km x 600 m (a world volume would swallow the sky in Cycles). Exposure per state from a 320 px grey-card probe (median luminance to 0.18; night: 80th percentile to 0.12), AgX Medium High Contrast.
- **night**: interiors glow per floor (L05 and L08 dimmer, as if partly let), 14 kW pink / violet spot uplights every 9 m round the base aimed up the facade, sodium street lamps (a spot under every lamp head), red sign, violet dome wash, city-glow night sky. Neighbour windows lit from the facade emission maps.
- **materials**: glass is a thin reflective tinted glass for Cycles (Fresnel mix, tint #6d9a98, 34 % reflection at normal incidence, no refraction); in the GLB it is a placeholder named facade_glass for the viewer's env-mapped glass. ACP satin metallic (0.75 metal, 0.3 rough); concrete, render, roofs and ground are true-scale procedural textures generated in numpy (no downloads, no satellite imagery).
- **ground layers**: each land-use layer sits on its own plane 3 mm apart, carriageways 7 cm above the ground, footpaths 15 cm, markings 12 mm above the asphalt, so no two surfaces share a plane.



## Results (19 Nov 2026, 03:05)

Web files in `twin/web/models/exterior/`: `rtp_building.glb` 2.06 MB, `rtp_context.glb` 8.27 MB (601k triangles,
238 draw calls, 29 instanced prop sets from 3,756 nodes), `rtp_terrain.glb` 1.06 MB, `lightmaps/` 13.4 MB (RTP 8.8,
Class B 2.1, ground AO 2.5), `env/` 2 HDRs 8.7 MB, `stills/` 9 JPEGs 5.3 MB, `exterior_viewer.json`.
Budgets: hero 2.06 + 8.8 lightmaps = 10.9 MB (< 25), context 8.27 + 4.6 = 12.9 MB (< 25), terrain 1.06 MB (< 8).
Loaded in three.js r169 with the meshopt decoder (`review/glb_check.html`): all three GLBs load, 104 + 238 + 1 meshes,
85 lightmapped, 290 draw calls, 739k triangles drawn; the frame renders (99 % non-background pixels). Frame rate was not
measured fairly (the pane was hidden and the GPU busy with Cycles).

Checks (`checks.json`, `review/checks_sheet.png`):
- footprints within 1 m: PASS (RTP slabs 0.00 m from the CAD; context max 0.76 m; RTP CAD vs Overture outline 4.1 m Hausdorff, IoU 0.91, informational).
- coplanar faces < 2 mm: FAIL, 7 triangle pairs, 0.022 m2 in total, all in the context (two overlapping-footprint slivers in Class C, footpath and compound triangulation slivers), none on RTP or Class B. 667 back-to-back party walls are reported separately (hidden inside the blocks).
- untextured / default materials: PASS.
- stills blown / crushed: PASS (worst: night court 5.2 % crushed, morning court 1.0 % blown).
- photo-match sheet: written (`review/photo_match.png`), but no camera-matched overlay: no reference photo is in the repo.

Times: lightmap bake 21.9 min (facade 9.2, slabs 6.6, Class B 4.0, ground AO 2.0; 2048 px, 64 samples); stills 21.7 min
for the final nine (1080p, 192 samples day, 256 night, 94-236 s each); env maps 18 s (day) and 33 s (night).

## Problems found and fixed during the night (so nobody repeats them)

- **Blender 5.2 sky sun direction.** `ShaderNodeTexSky.sun_rotation` is the azimuth measured clockwise from north
  (checked with coloured markers on an equirectangular render, `_build/eqtest.py`). The first full set of stills used
  `90 - azimuth` and so had the sun in the wrong place; every day still and the day environment map were re-rendered.
  The lightmap bake never used the sky (it uses sun lamps from the computed sun vectors), so the bake was not affected.
- **World volume swallows the sky in Cycles.** Haze is a scattering box instead (7 x 7 km, 160 m tall). A 600 m lid
  left denoiser blotches in the sky; the low lid keeps the horizontal aerial perspective and a clean sky.
- **Sun as a lamp.** The sky's own sun disc is measured on a sky-only equirect and replaced by a SUN lamp of the same
  irradiance and colour (morning 126 W/m2 luminance-weighted, golden 11 W/m2, deep orange), so shadows and haze sample cleanly.
- **Coplanar faces.** Fins stacked 0.2 m into the next floor, mullion boxes cut the glass plane at corners, the lobby
  soffit sat on the level-2 band cap, ground layers shared z = 0 with the roads. All moved apart (see checks.json).

## Equirectangular environment maps

`twin/web/models/exterior/env/rtp_env_day.hdr` and `rtp_env_night.hdr`, 2048 x 1024, linear Radiance HDR, taken from the
court at 12 m (rtp_local -14.5, 37.8). Image centre = east, left quarter = north, right quarter = south (measured), so
three.js `EquirectangularReflectionMapping` needs no rotation. The day map keeps the sun disc for glass glints; haze is off.

## Known issues

- Floor count (G + 9), drum/dome/sign positions, the spine, the lobby chamfer, Class B names and the substation and pond
  positions are assumptions (above). The court layout is invented.
- Cars and buses are low-poly blocks; palms are good from 20 m, not close up. Class C houses are typed boxes with
  tinted window textures, mono-pitch or gabled roofs and tanks: credible from the hero views, plain at street level.
- The night Class B offices read as bright bands; the 'day' lightmap bakes a midday sun, so in the viewer use the `ao`
  and `sun` maps with a live sun for other states.
- 7 tiny coplanar slivers remain in the context (see checks).
- The existing Skymark viewer is not in `airoli-rtp/twin/web/`; `exterior_viewer.json` follows its lightmap conventions but no viewer page was wired.

## Open questions for the founder

1. Floor count and floor-to-floor height (a section drawing would settle G + 9).
2. Where exactly are Sutherland, BSV, Lumina CloudInfra, Gramercy and Clover? Open data names only Liberty Tower and Empire Tower.
3. Which neighbour has the louvred car park under a glass tower?
4. May the RELIABLE sign and logo appear in client material?
5. Reference photos (brochure or drone) for the camera-matched photo overlay (plan gate E2).
