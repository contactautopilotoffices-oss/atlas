---
name: archviz-sales-configurator
description: How a building's 3D page should work as a sales and leasing tool, learned from the reference video of easybooknow (a residential block shown on a desktop and a laptop: a photoreal 3D of the block in a warm, muted city; a floor picker on the left and the floor's units with type, area, price and an availability chip on the right; picking a floor cuts the building open and colours every unit by status with a label on each; a unit opens its 2D plan with its figures and Call, E-mail and WhatsApp; tabs for 3D, Plan, Gallery, Tour and Neighbourhood). Use whenever a property page needs floors, units or spaces to be picked, compared or enquired about, including /skymark, the Flipkart explorer and any leasing showcase.
---

# The 3D page as a sales tool

Read `archviz-quality-bar` and `archviz-floor-zoom` first.

## What the reference does (easybooknow, 12 s screen capture)

1. **One bar of tabs across the top:** 3D · Plan · Galerie · Visite · Quartier (3D,
   plan, gallery, tour, neighbourhood). One product; every view is a tab, not a new page.
2. **The 3D hero.** The block is photoreal: warm terracotta and cream facades, balconies with
   planters, glass, roof plant and solar, soft late-afternoon light, long shadows. The city
   round it is the same warm palette, but plainer: massing in cream and sand with roads,
   pavements and street trees. Context is muted on purpose so the building leads, but it is
   never stark white: it is lit, shadowed and coloured to sit with the hero.
3. **Left: the floor picker.** A small thumbnail of the whole block over a list:
   Ensemble (whole building), then R+8 … R+1 (ground plus n), the picked floor in a black
   pill, with "R+5 · 3 disponibles" (how many are free on that floor) under the thumbnail.
4. **Right: the floor's units.** For the picked floor, a list of its units: number (501,
   502 …), type and area (T4 · 141 m²), price, and a status chip (green Disponible; others
   Réservé or Vendu). The list and the 3D are one selection: hover one, the other lights.
5. **Picking a floor cuts the building open.** Floors above lift away, the city drops to a
   flat sand ground with the roads drawn on it, and the floor plate shows every unit as a
   filled shape coloured by status (lime green free, pink reserved or sold, grey common
   parts), with a floating label on each unit (its number or room name). Partitions stay as
   low walls so the plan reads in 3D.
6. **A unit opens its plan.** The Plan tab shows the unit's 2D plan large on white, and a
   side card: APPARTEMENT 502, Disponible, type T4, 141 m², floor R+5, balcony 41.8 m²,
   scale 1:100, Download the plan, then Call and E-mail, with a WhatsApp button pinned
   top right on every view.
7. **Gallery.** Full-screen photoreal stills (the hero, the corner, close-ups of the
   balconies and planting), with a thumbnail strip.

## What this means for our pages

- **Context colour.** Our cities are white boxes with a window grid. Use the hero's
  palette instead: warm cream and sand massing, slightly varied per block, with ambient
  occlusion and real shadows, asphalt roads and pavements, trees. Keep it plainer than
  the hero; never pure white.
- **Units, not just floors.** For an office building the "units" are the leasable spaces
  or the tenant's rooms: on a floor we fit out (Volt on Skymark's first floor) the rooms are
  the units, each coloured by kind and labelled; on a bare floor, the floor's leasable
  units or the whole plate, with area and availability.
- **Availability on the picker.** Every floor row says what is free on it, and the
  offered floors stand out (we already light them amber; add the count and the status).
- **One selection across views.** Floor list, unit list, the 3D and the plan are one state.
- **Enquiry everywhere.** A Call / E-mail / WhatsApp action on the unit card and a
  persistent WhatsApp button. Our gate already knows who is signed in.
- **Tabs.** 3D · Plan · Gallery (our Cycles stills) · Tour (walk mode) · Neighbourhood
  (the map and the walk to the metro).

## Scoring (add to the quality bar)

- Can a first-time viewer pick a floor, see what is free on it and open one unit's plan in
  three clicks?
- Does the context sit in the hero's palette and light, with shadows, and no white boxes?
- Does every view carry the enquiry action?
