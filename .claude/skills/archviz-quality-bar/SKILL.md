---
name: archviz-quality-bar
description: The quality bar for every Autopilot real-estate 3D output (Blender stills, flythroughs, dioramas, the web explorer), learned from five reference videos (location mapping, facade and camera language, facade to interior, floor zoom to interior, day to night lighting). Read this first whenever a task builds, renders or reviews a building, a district, an interior or a 3D page, and before any of the archviz-* skills. It says what "world class" means here, what our pipeline currently gets wrong, and how to score an output before showing it.
---

# Archviz quality bar

We sell office and residential space. A buyer judges the building by its
exterior, its street and its inside, so a render that shows block facades,
flat walls or empty glass loses the room. Five reference videos set the bar
(summarised in the sibling skills). All five are real-time engine work
(Unreal Engine 5 class: Lumen GI, Nanite detail, scanned assets) or offline
path tracing. Their quality comes from **geometry depth, real materials,
light that bounces, and a camera that tells a story**, not from the engine.

Use the sibling skills for each part:

| Skill | Reference | What it covers |
| :- | :- | :- |
| `archviz-location-mapping` | Camera movement and location mapping | The aerial context map, POI pins with distance and time, the route line, the site outline, and the fly-down |
| `archviz-facade-detail` | Facade, camera angles and environment | Facades with real depth, materials, street life, and the shot list |
| `archviz-facade-to-interior` | Facade to interior transition | One continuous move from aerial into a fitted floor, and walkable interiors |
| `archviz-floor-zoom` | Floor zoom to 3D transition | Choosing a floor, zooming to the unit, and room-by-room interiors |
| `archviz-lighting-day-night` | Lighting, daylight to sunlight | Sun and sky, golden hour, dusk, night with lit windows, and the light-control UI |

## What our pipeline gets wrong today (Nov 2026 audit)

From `scripts/world/` (diorama.py, textures.py, build.py) and the explorer:

1. **Facades are flat.** Windows, mullions and chajjas are painted into a
   texture on a flat wall. Real facades have 150 to 600 mm of depth: reveals,
   fins, slab edges, balcony slabs, setbacks. The flat wall gives it away
   from any angle off square.
2. **Glass is empty.** There is nothing behind it. Reference glass shows
   ceilings, lights, furniture and people inside, and reflects the sky and
   the street.
3. **Materials are single-colour.** There are no panel joints, no stone
   veining, no roughness variation, no edge wear, and no bevels, so every
   edge is a knife edge that catches no light.
4. **Low-poly entourage.** Trees are blobs or leaf cards, cars are boxes,
   and there are no people, benches, pergolas, signage or planters.
5. **Lighting is direct sun only.** There is no HDRI sky, no bounce light
   (GI) in real time, no light inside the building, no night interiors and
   no facade lighting.
6. **The camera is static or an orbit.** There is no shot language: no
   foreground framing, no low angle, no dolly, no transition into the
   building.
7. **No interiors**, and no way to pick a floor or a unit.
8. **The context is weak.** The district is a box field on flat ground with
   no terrain, water or texture detail. The reference district reads as a
   real city from 3 km up.

Do not repeat these. Every new output must clear the checklist below.

## Before showing any output: the scorecard

Score each line 0 to 2 and fix anything under 2 on the hero building:

- [ ] **Depth:** facade elements are modelled (reveals, fins, slabs,
  balconies, mullions), not painted. Bevel radius is 5 to 20 mm on every
  hard edge.
- [ ] **Glass:** the glass reflects the sky, and the interior behind it reads
  (a modelled interior, interior mapping, or a backlit interior card per
  floor).
- [ ] **Materials:** stone, metal, wood and plaster have real PBR maps
  (albedo, roughness, normal) at true scale, with panel joints and some
  variation and dirt.
- [ ] **Ground plane:** kerbs, pavers, road markings, planters, grass with
  variation, and puddle or wet sheen if the time is after rain.
- [ ] **Entourage:** high-poly trees (proper branches and leaves), real car
  models, people at the entrance and on footpaths, street lamps, benches.
- [ ] **Light:** HDRI or physical sky, sun angle chosen for the facade
  (raking light), soft shadows, GI (Cycles, or baked lightmaps on the web),
  and AgX or Filmic with a measured exposure.
- [ ] **Camera:** a real shot from the shot list (`archviz-facade-detail`).
  Verticals corrected. A lens between 18 and 35 mm for architecture and
  50 to 85 mm for details. A foreground layer for depth.
- [ ] **Story:** the output answers a buyer question (where is it, what does
  it look like, how do I get there, what is inside, what does it look like
  at night).
- [ ] **Data truth:** names, floors, distances and figures come from the deck
  or the measured sources. Nothing is invented (see the atlas rule:
  "anything not in the deck does not appear").

## What the web can and cannot do

The references are pixel-streamed or pre-rendered engine output. A static
three.js page on a laptop GPU cannot match Lumen GI live. So:

- **Hero quality** (stills, flythrough videos, 360 panoramas) comes from
  Blender Cycles, rendered offline, and is shown on the page as images,
  video or panoramas.
- **Interactive** three.js views use baked lighting (Cycles lightmaps or
  vertex AO), PBR textures, an HDRI environment and high-detail geometry on
  the hero building only. The context stays lighter.
- **Live UE-class interactivity** (free walk with real-time GI) needs pixel
  streaming on GPU servers. That is a product decision, not a code change;
  flag it rather than fake it.

## Assets

High-poly assets (trees, cars, people, furniture, scanned materials) make
most of the difference. This sandbox cannot reach Poly Haven, ambientCG or
Sketchfab. Procedural assets (Geometry Nodes trees, modelled furniture,
painted PBR maps) are a fallback, not the target. When a job needs world-class
output, ask for an asset pack (for example Quixel Megascans, Botaniq trees,
Evermotion or Kitbash3D interiors and cars, licensed for commercial use), or
a reachable asset host, before starting.
