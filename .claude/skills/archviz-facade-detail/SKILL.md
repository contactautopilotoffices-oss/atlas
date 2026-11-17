---
name: archviz-facade-detail
description: How to model, texture, dress and shoot a building exterior to real-estate marketing standard, learned from the reference video "Facade and camera angles and environment" (a mixed-use district: towers with vertical fins and setbacks, a stone-clad retail podium with lit shopfronts and signage, landscaped podium with pool, a double-height lobby, street life). Use whenever a building facade, podium, entrance, street or landscape is built or rendered in Blender or three.js, and for choosing camera angles and the shot list of a property film.
---

# Facade detail, environment and the shot list

Read `archviz-quality-bar` first.

## What the reference shows (Vancore mixed-use district)

**Towers**
- The towers are stacked boxes with setbacks every 4 to 6 floors. The
  massing breaks up, so no tower is one extruded prism.
- Vertical fins in two tones (dark bronze and light champagne) run in an
  irregular rhythm. Some fins are 300 mm proud, some 600 mm, and their
  spacing varies by bay.
- Behind the fins is a full curtain wall with visible floor slabs and
  ceiling lights.
- At night the fins are uplit (linear LEDs at each fin base), so every fin
  reads as a warm stripe.
- One tower is pure reflective glass with an expressed mullion grid. It
  reflects the sky and its neighbours.

**Podium and retail**
- Grey stone or GRC panels with visible joints (1.2 by 0.6 m modules) and a
  deep frame around each bay.
- Each shopfront is double-height glass with a fitted interior visible
  (tables, counters, pendant lights) and a backlit sign band ("PIZZA",
  "SEA FOOD", "MedINA").
- There is a terrace level above with glass balustrades and diners.
- Benches, bollards, street lights and people sit on the footpath.

**Lobby and landscape**
- The lobby is a double-height glass box with a sculptural ring chandelier,
  revolving doors, potted plants and a car at the drop-off.
- Hard edges carry bevels everywhere.
- The landscaped podium has a pool, timber decks, dense planting and
  curving paths.
- Trees are layered (canopy trees, palms, shrubs, ground cover), never
  single objects.
- Pergolas cast striped shadows on patios. The raking sun makes the shadows
  part of the design.

**Shot list (the order of the film)**
1. Black card, then the title in thin italic caps ("TAKE YOUR CLIENT").
2. Top-down drone over the plot at noon ("FROM THE SKYLINE").
3. Low-angle tower shot through foreground leaves, 18 to 24 mm, sky behind,
   at dusk (the fins glow).
4. A frontal elevation of the retail podium, eye level, people walking
   ("THROUGH THE COMMERCIAL DISTRICT").
5. A wide of the towers over trees from the green spine ("ACROSS THE GREEN
   AREAS"), then a top-down of the pool deck.
6. A lobby approach at eye level with a car arriving ("TO THEIR FRONT
   DOOR"), then a slow move through pergola shadows.
7. A close parallax shot past a car at the drop-off ("ONLY IN SECONDS").
8. A hero wide of the whole district at golden hour, then the logo and the
   call to action.

Text sits centred in light italic caps with one bold word, and fades on
each cut. Shots are 1.5 to 3 s long, and the cuts land on the music.

## How we build it (Blender)

**Massing and the facade system**
- Build every facade from parts, never a painted texture. Model one bay as a
  module (slab edge, spandrel, glass, mullions, fin), then array it along
  each face with Geometry Nodes: sample the face, place the bay on a 1.5 m
  grid, and randomise fin depth and tone from a seed per bay.
- Real depths:
  - glass set back 150 to 250 mm from the slab edge;
  - slab edge 300 to 450 mm deep;
  - fins 300 to 900 mm;
  - balcony slab 1.2 to 1.8 m, with a glass balustrade 1.1 m high.
- Bevel every hard edge with a Bevel modifier (5 to 20 mm, 2 or 3 segments,
  limit by angle 30 degrees, harden normals). This is the single cheapest
  realism win.
- Setbacks: split the tower into stacks of 4 to 6 floors. Offset or rotate
  some stacks, and put terraces with planters on the steps.
- Podium: 2 levels of retail, 5 to 6 m floor height, stone or GRC frame,
  and recessed glass.

**Materials (PBR, true scale)**
- Glass: Principled BSDF, transmission 1, IOR 1.52, roughness 0 to 0.05, a
  slight tint (0.85 to 0.92 green-grey) and thin-film or coating
  reflectance. Never a dark opaque colour.
- Interiors behind glass, in order of preference:
  1. modelled ceilings, lights and furniture for the hero floors;
  2. interior mapping (a parallax shader that fakes a room box per window);
  3. a backlit interior photo card 0.5 to 1 m behind the glass.
- Stone and GRC: albedo with veining, a roughness map, and a normal map with
  panel joints (a 10 mm groove) every 1.2 by 0.6 m.
- Metal fins and mullions: anodised aluminium (metallic 1, roughness 0.25
  to 0.4), or a bronze tint for warm fins.
- Grime: an ambient-occlusion-driven dirt mask under sills and at the base,
  plus vertical streaks. Mumbai facades need monsoon staining.
- Texel density: at least 512 px per metre on the hero building, 128 px per
  metre on context.

**Ground and entourage**
- Roads: asphalt with roughness variation, lane markings, zebra crossings
  at junctions, manhole covers. Footpaths: pavers with a 150 mm kerb.
- Planting: canopy trees with real branches (Geometry Nodes or a tree
  generator, at least 20k leaves on hero trees), palms, shrubs and ground
  cover in layers, with colour variation per instance.
- People and cars: real models (at least 10k triangles per car), placed by
  the entrance and kerbs, a few in motion. Mumbai: autos, black-yellow
  taxis, BEST buses.
- Street furniture: lamps, benches, bollards, bins, bus shelters, signage.

**Camera**
- Architecture: 18 to 35 mm, with verticals kept straight. Keep the camera
  level and shift the lens (shift_y), or tilt and correct in post. Low
  angle 1.2 to 1.7 m for a pedestrian, 0.3 to 0.6 m for drama.
- A foreground layer in most shots: leaves, a pergola edge, a car body or a
  railing, 1 to 3 m from the lens and out of focus. It is what makes a
  frame look photographed.
- Moves: a slow dolly or truck (0.3 to 1 m/s), a crane up the facade, or a
  parallax pass by a foreground object. No orbit-for-orbit's sake.
- Render: Cycles, 256 to 1024 samples with denoising, AgX with a measured
  exposure, motion blur on moving shots, a light bloom and slight vignette in
  compositing.

## Checklist

- [ ] The facade is modelled with depth and bevels, and no window is only
  paint.
- [ ] The glass shows an interior and reflects the sky.
- [ ] The podium has lit shopfronts, signage and people.
- [ ] Landscape is layered planting, with pergola or tree shadows on hard
  ground.
- [ ] Each shot comes from the shot list, with a foreground layer and
  straight verticals.
- [ ] Names on signage or canopies come from the deck.
