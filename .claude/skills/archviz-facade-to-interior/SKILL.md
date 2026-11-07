---
name: archviz-facade-to-interior
description: How to take the viewer from the city into a fitted floor in one continuous move, and make the interior walkable, learned from the reference video "Facade to interior 3D transition movable" (a 360 View app: aerial with amenity pins, a dive down the tower facade, through the glass into a fitted office floor, then a walk past reception, lounges, planters and the window view). Use when building an interior, a floor walk-through, an exterior-to-interior camera move, or a 360 or walk mode.
---

# Facade to interior

Read `archviz-quality-bar` first.

## What the reference does (205 Towers, Vancore 360 View)

1. **The aerial** has pins for every amenity (Retail, Kids Area, Gym,
   Elevator, Entrance, Co-working, Outdoor, Podium Outdoor, Spa) as small red
   icon labels. It is portrait, made for a phone.
2. **The dive:** the camera drops past the tower's vertical fins (ribbed
   precast or metal, deep shadows between them), close enough to see the
   facade module, then turns into the glass.
3. **The cut through glass** is a fast push with motion blur and a brief
   exposure shift (the interior is darker than the sky). There is no fade to
   black.
4. **The interior** is a fitted office:
   - warm timber-clad columns with rounded corners, and dark slatted walls;
   - a black open ceiling with exposed services and a linear light slot;
   - pale timber or vinyl floor, and arched alcoves with green upholstery;
   - mustard lounge chairs, round tables and bar stools at a counter;
   - planter boxes with dense monstera and ferns along the windows.
   Ceiling fixtures are real (round pendants, recessed downlights, cove
   lighting). Daylight enters from the windows, and the view out shows the
   real city.
5. **Movement:** a smooth first-person glide at eye height (1.6 m),
   turning to reveal zones. At the end it flies back out through the glass
   to the aerial. A side rail of icons switches mode (home, unit, plan,
   gallery, exit).

## How we build it

**Interior model (Blender)**
- Start from the real floor plate: the footprint offset in by the facade
  depth, core position (lifts, stairs, toilets) and column grid (8 to 9 m).
  Floor-to-floor height comes from the deck, with a ceiling at 2.8 to
  3.0 m for offices.
- Fit-out kit: reception desk, open desks, a meeting room with glass
  partitions, lounge chairs, a pantry counter with stools, planters and
  pendants. Furniture must be real models with bevels and fabric or wood
  materials. Box furniture reads as a placeholder.
- Materials:
  - oak or walnut veneer (roughness 0.35 to 0.5);
  - fabric with a sheen and normal weave;
  - matte black ceiling, polished concrete or vinyl floor;
  - brushed metal for legs;
  - glass partitions with frit or film.
- The view out: either the actual diorama around it, visible through the
  windows (best), or an HDRI or rendered panorama from that floor's height
  and direction.

**Light inside**
- A sun and sky through the windows (Cycles portals on each window, or
  a light portal per facade), plus area lights for ceiling panels at 4000 K,
  pendants at 2700 to 3000 K, and cove strips.
- Exposure: interiors sit about 2 stops under the sky. Expose for the
  interior, and let the windows bloom a little.

**The transition (camera)**
- One Bezier path from the aerial (200 to 400 m out) down the facade (5 to
  15 m off the glass) to a window, then 4 to 6 m into the room at 1.6 m
  height. Ease in and out. Speed peaks at the facade and slows to walking
  speed inside.
- Glass handling: hide the pane the camera passes through for the last
  0.3 s (or set it to camera-ray invisible), so the lens never clips the
  mullion.
- Exposure ramp: animate the exposure about 1.5 to 2 stops up over 0.5 s as
  the camera crosses inside, the way a real camera adapts.

**Walkable on the web**
- Option A: pre-rendered 360 panoramas at 6 to 12 points per floor
  (Cycles equirectangular, 4096 by 2048, denoised), with hotspots between
  them. This gives photoreal quality on any phone, and is what most real
  estate tours do.
- Option B: real-time three.js with lightmaps baked in Cycles per object,
  PBR textures and reflection probes. Free movement, but lower realism.
- Use Option A for the sales experience and Option B for the plan or layout
  tool.

## Checklist

- [ ] The floor plate, core and column grid match the building. Heights come
  from the deck.
- [ ] Furniture is real models with real materials, and plants are dense.
- [ ] Daylight comes from the windows, ceiling fixtures are real, and the
  view out is the real city.
- [ ] The camera move is continuous from the facade into the room, with no
  clipping through glass.
- [ ] Exposure adapts on entry. Motion blur is on during the dive.
