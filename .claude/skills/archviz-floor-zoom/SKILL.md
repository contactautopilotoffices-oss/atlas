---
name: archviz-floor-zoom
description: How to let a buyer pick a floor and zoom from the tower into that unit's rooms, learned from the reference video "Floor zoom to 3D transition" (a waterfront residential tower at golden hour: the floor is selected, the camera pushes to it, and the view opens into a fully furnished living room, then the bath and bedroom, with a room label and a register-interest button). Use for floor or unit selectors, "choose your floor" flows, unit tours, and luxury residential or office interiors.
---

# Floor zoom to the unit

Read `archviz-quality-bar` and `archviz-facade-to-interior` first.

## What the reference does (Samar, Omnyalab)

1. **The tower** stands alone at golden hour on the waterfront, with a
   marina and yachts, and the city in haze behind. Curved white balcony
   slabs wrap every floor, with glass balustrades and warm light inside.
   A small card on the right shows the selected floor ("14") and a
   button.
2. **The zoom:** the camera pushes in to the chosen floor along the
   facade, closer and closer to the balcony edge (the slab thickness, the
   balustrade and the interior lights are all modelled), then crosses the
   balcony into the room.
3. **The living room:**
   - a slatted timber ceiling with deep beams;
   - book-matched stone or timber wall panelling and a TV unit;
   - a large grey sectional sofa and leather lounge chairs;
   - a patterned rug and a brass branch chandelier.
   Warm light is everywhere, with the sea through floor-to-ceiling glass.
   A room label sits bottom left ("Living Room") with a "Back to the tower"
   button and "Register interest".
4. **Room hops:** cut or glide to the bath (a freestanding stone tub, marble
   walls, a glass shower, the sea view) and the bedroom (timber, a niche, a
   vase), each with its own label. It ends back on the tower and the logo.

## How we build it

**The tower and the floors**
- Every floor is addressable. Model the tower per floor (or tag each slab
  with its floor number as an attribute), so a selected floor can be
  highlighted (an emissive edge or a raised exposure on that band), labelled
  and targeted by the camera.
- The balcony edge is the close-up hero. Give it:
  - a slab nose with a rounded profile (bevel 100 to 300 mm on curved
    towers);
  - a soffit with downlights;
  - a balustrade with glass, a handrail and fixings.

**The zoom camera**
- A path from a 3/4 tower view (300 to 600 m) to 6 m off the selected floor,
  then through the opening. Use a longer lens at the start (50 to 85 mm,
  compressed and flattering) and widen to 24 mm as it enters: animate the
  focal length with the move (a "dolly zoom out").
- Golden hour sun from behind and to the side of the camera, so the tower is
  rim-lit and the interior glows warm against a cooler sky.

**Interiors to luxury standard**
- Ceiling detail (slats, coffers, coves) does most of the work. Model it.
- Materials:
  - stone with real veining (book-matched across panels);
  - timber with grain direction following the panel;
  - leather and fabric with a sheen;
  - brushed brass with roughness 0.2 to 0.3.
- Lighting:
  - cove LEDs at 2700 K;
  - a chandelier of small point or area lights with emissive bulbs;
  - table lamps;
  - the window to the sky as the key light;
  - exposure set for the room.
- Composition: one-point or two-point perspective at 1.2 to 1.4 m, with
  verticals straight and the window view part of the frame.

**On the page**
- Use a floor picker that highlights the band on the tower (three.js:
  emissive on that floor's instance range, or an overlay mesh). Selecting a
  floor runs the pre-rendered zoom clip (Cycles video, WebM or MP4), then
  opens 360 panoramas of the rooms with room labels and hotspots.
- Data per floor (carpet area, availability, rent) comes from the deck
  only.

## Checklist

- [ ] The selected floor is visibly highlighted and labelled with deck data.
- [ ] The balcony edge, soffit and balustrade hold up at 2 m from the lens.
- [ ] The interior has ceiling detail, real furniture and veined stone or
  grained timber.
- [ ] The light is warm inside, the sky cooler, and the window view real.
- [ ] Every room has a label and a way back to the tower.
