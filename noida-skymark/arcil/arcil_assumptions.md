# ARCIL, floor 2: assumptions

The 3D floor is built from the fit-out drawing `20260923_SKY MARK NOIDA_2nd floor_ARCIL.dwg`. Everything below is **not** in that drawing and was assumed or inferred. Seat counts are not affected by any of it: they come from the chair blocks in the drawing (252 work seats, 328 seats in all).

## Heights
- **Ceiling height 2.85 m: assumed.** The drawing is a plan only. It has no section, no elevation and no ceiling level mark.
- **Wall and partition height 2.85 m: assumed** (full height to the ceiling).
- **Desks 0.75 m, high desks 1.05 m, coffee tables 0.42 m, planters 1.05 m: standard furniture heights, assumed.**
- **Floor-to-floor height.** The stair notes in the drawing say `RISER-3900`, i.e. a 3.9 m rise per floor. The building model (made from photos) uses 4.1 m, and the 3D view keeps 4.1 m so this floor lines up with the building. The difference (0.2 m per floor) is not resolved; nothing in the drawing gives a section to settle it.
- **Window sill and head heights: not in the drawing.** 22 facade openings are read from the plan (position and width only). The 3D facade uses full-height glazing between the sill line and the ceiling, which is an assumption.

## Ceiling and services
- **Ceiling types are from the drawing's reflected ceiling plan** (2'x2' grid tiles and gypsum regions). Where a room shows neither, it is marked 'open / not drawn' and is shown as a plain flat ceiling.
- **Light fixtures are the ones drawn** (85 panel600, 110 downlight, 1 linear). Light output, colour temperature and mounting height are not in the drawing and are assumed.
- **AC grilles, diffusers and indoor units are not drawn.** The file has layers named `AC Grill` and `AC-RA-GRILLE` but they are empty. None are shown in 3D.
- **Sprinklers, smoke detectors, speakers and access-control devices are not drawn** and are not shown.

## Rooms and boundaries
- Room outlines follow the drawing's wall, glass and railing lines, with doors closed along their leaves. Where the drawing leaves a gap, a closing line was added; every one is listed in `cad/tenants/arcil.json` with its reason:
  - wall gap closed: wall between OCCUPIED SPACE and the east lift lobby stops 1 m short of the south wall: closes ARCIL's core off from the other tenant
  - wall gap closed: gents toilet (east core) entry has no door block
  - wall gap closed: west toilets: the back-to-back WC duct between GENTS and LADIES is drawn only as fixtures, not as a wall
  - wall gap closed: pantry entry from the west passage has no door block
  - wall gap closed: 16 PAX conference room: the front partition is not on a wall or glass layer (only its door is drawn)
  - wall gap closed: server room / UPS-battery room front partition not drawn on a wall or glass layer
  - wall gap closed: partition between server room and UPS/battery room stops short of their front
  - zone line (no wall exists; shown as open floor): zone boundary, not a wall: separates the locker passage (circulation) from the reception lobby
- 69 short openings with no door block (toilet entries, lift doorways, gaps at the facade bays) were closed automatically where two wall ends face each other across 0.55 to 1.15 m; they are listed in the layout file under `closures`.
- Label change: CAD labels both 8-pax rooms 'RM 02'; the west one is renamed RM 01
- Label change: CABIN-01 text sits in the locker passage; moved into the cabin
- Label change: CABIN-03 text sits outside the plate edge; moved into the cabin
- Label change: 'RECEPTION' beside the west stair is the other tenant's reception, not an ARCIL room
- Label change: CAD writes GENTS and TOILET-01 as two texts
- Label change: CAD writes LADIES and TOILET-01 as two texts
- Label change: 16 PAX CONFERENCE ROOM text sits on the room's front line; moved inside
- Label change: 'ELECTRICAL PANEL' here marks a wall-mounted panel in the east lift lobby, not a room
- Label change: 18 workstations east of the main hall have no label of their own (part of the 238)
- Open-plan areas are zones, not walled rooms: WORKSTATION - 238 NOS, PANTRY. Their edges follow the desk clusters or furniture groups; what is left is shown as circulation.
- Areas the drawing marks as another tenant's (labelled OCCUPIED SPACE on this plan (another tenant)) are shown as `not demised` and are not part of this floor's rooms.
- Some 'feature walls' are inferred: an unnamed 1.09 x 0.09 m block drawn against meeting-room walls is taken to be a wall-mounted screen. The drawing does not name it.

## Furniture and fittings
- Lockers: the plan draws 34 locker columns; the number of tiers (6) is taken from the drawing's labels (204 lockers). The locker height is assumed.
- Chairs, desks, tables, sofas and plants are placed exactly where the drawing places them; their 3D shapes are generic models of the right size, not the specified products.
- Finishes (carpet, wood, tile, stone, vinyl) are chosen by room type. The drawing has no finishes schedule.
- Basins, mirrors and cubicle partitions in the toilets are not all drawn as blocks; only the WC, urinal and health-faucet blocks are placed.

## Position in the building
- This floor is placed on level 2 of the building model by matching the drawing's columns to the first-floor drawings (Volt and Paytm), then using Volt's fit to the building's map footprint. See `cad/plate_fit.md`.
- The drawing's second floor reaches the street front like the first floor, but the photo-based building model sets its front facade further back above the two-storey annex. The drawing is followed here: the floor outline is exported as drawn, and the part outside the building model is listed as `twin_overhang` (241.7 m2).
- Units: the drawing is in inches (converted at 25.4 mm). Its mm notes (lift 2025 x 2025, stair width 1500) agree with the geometry at that scale.
