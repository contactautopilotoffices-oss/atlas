# Paytm, floor 1: assumptions

The 3D floor is built from the fit-out drawing `20261105_SKY MARK NOIDA_1ST_PAYTM.dwg`. Everything below is **not** in that drawing and was assumed or inferred. Seat counts are not affected by any of it: they come from the chair blocks in the drawing (244 work seats, 313 seats in all).

## Heights
- **Ceiling height 2.85 m: assumed.** The drawing is a plan only. It has no section, no elevation and no ceiling level mark.
- **Wall and partition height 2.85 m: assumed** (full height to the ceiling).
- **Desks 0.75 m, high desks 1.05 m, coffee tables 0.42 m, planters 1.05 m: standard furniture heights, assumed.**
- **Floor-to-floor height.** The stair notes in the drawing say `RISER-3900`, i.e. a 3.9 m rise per floor. The building model (made from photos) uses 4.1 m, and the 3D view keeps 4.1 m so this floor lines up with the building. The difference (0.2 m per floor) is not resolved; nothing in the drawing gives a section to settle it.
- **Window sill and head heights: not in the drawing.** 21 facade openings are read from the plan (position and width only). The 3D facade uses full-height glazing between the sill line and the ceiling, which is an assumption.

## Ceiling and services
- **Ceiling types are from the drawing's reflected ceiling plan** (2'x2' grid tiles and gypsum regions). Where a room shows neither, it is marked 'open / not drawn' and is shown as a plain flat ceiling.
- **Light fixtures are the ones drawn** (114 downlight, 25 linear). Light output, colour temperature and mounting height are not in the drawing and are assumed.
- **AC grilles, diffusers and indoor units are not drawn.** None are shown in 3D.
- **Sprinklers, smoke detectors, speakers and access-control devices are not drawn** and are not shown.

## Rooms and boundaries
- Room outlines follow the drawing's wall, glass and railing lines, with doors closed along their leaves. Where the drawing leaves a gap, a closing line was added; every one is listed in `cad/tenants/paytm.json` with its reason:
  - wall gap closed: lift 1 doorway (no door block for lift doors)
  - wall gap closed: west toilets: the back-to-back WC duct between GENTS and LADIES is drawn only as fixtures, not as a wall
  - zone line (no wall exists; shown as open floor): zone boundary, not a wall: reception/waiting area vs the entry lobby
  - zone line (no wall exists; shown as open floor): zone boundary, not a wall: reception/waiting area vs the north corridor
  - zone line (no wall exists; shown as open floor): dry pantry-01 alcove: open counter front
  - zone line (no wall exists; shown as open floor): zone boundary, not a wall: Autopilot reception lobby vs the wet-pantry passage
  - zone line (no wall exists; shown as open floor): zone boundary, not a wall: reception/waiting area vs the 5' passage running east
  - zone line (no wall exists; shown as open floor): zone boundary, not a wall: collab area vs the ENTITY-02 workstation hall
  - zone line (no wall exists; shown as open floor): zone boundary: collab area top, between the hall edge and the wet-pantry wall
  - zone line (no wall exists; shown as open floor): zone boundary: collab area vs the service passage (partition stops 1.5 m short of the facade)
  - zone line (no wall exists; shown as open floor): zone boundary: janitor's closet (south) vs the service passage
  - zone line (no wall exists; shown as open floor): wet pantry: open counter front
  - zone line (no wall exists; shown as open floor): zone boundary: dry pantry-02 alcove at the south end of the 4'8" passage
- 73 short openings with no door block (toilet entries, lift doorways, gaps at the facade bays) were closed automatically where two wall ends face each other across 0.55 to 1.15 m; they are listed in the layout file under `closures`.
- Label change: label sits on the room's top edge; moved inside (4-seater meeting room 02, west)
- Label change: label sits on the room's top edge; moved inside
- Label change: right-aligned text: its insertion point is at the room's bottom-right corner; moved into the room it names
- Label change: right-aligned text at the room's bottom-right corner; moved inside
- Label change: the conference room's own text sits on its top edge, next to LOUNGE AREA; moved inside so the room is not called LOUNGE AREA
- Label change: LOUNGE AREA names the sofa area north-east of the conference room, not the room itself
- Label change: 'DB PANEL' marks a wall-mounted distribution board in the passage, not a room
- Label change: 'SHAFT' text sits in the collab area; the shaft it names is the small duct beside the janitor's closet
- Label change: CAD writes GENTS and TOILET-01 as two texts
- Label change: CAD writes LADIES and TOILET-01 as two texts
- Label change: 'ELECTRICAL PANEL' marks a wall-mounted panel in the service passage, not a room
- Label change: right-aligned WET PANTRY text: its insertion point is just outside the pantry's open front
- Label change: the east stair has no STAIRS note on this plan (only UP / DN)
- Open-plan areas are zones, not walled rooms: WORKSTATION - 71 NOS (3'0"X1'7"). Their edges follow the desk clusters or furniture groups; what is left is shown as circulation.
- Areas the drawing marks as another tenant's (large enclosed area with no furniture on this plan (not fitted out for this tenant)) are shown as `not demised` and are not part of this floor's rooms.
- Some 'feature walls' are inferred: an unnamed 1.09 x 0.09 m block drawn against meeting-room walls is taken to be a wall-mounted screen. The drawing does not name it.

## Furniture and fittings

- Chairs, desks, tables, sofas and plants are placed exactly where the drawing places them; their 3D shapes are generic models of the right size, not the specified products.
- Finishes (carpet, wood, tile, stone, vinyl) are chosen by room type. The drawing has no finishes schedule.
- Basins, mirrors and cubicle partitions in the toilets are not all drawn as blocks; only the WC, urinal and health-faucet blocks are placed.

## Position in the building
- This floor is placed on level 1 of the building model by matching the drawing's columns to the first-floor drawings (Volt and Paytm), then using Volt's fit to the building's map footprint. See `cad/plate_fit.md`.
- Where the drawing's floor runs past the photo-based building model, a two-storey glass block (the 'podium') closes the gap, as for Volt.
- Units: the drawing is in inches (converted at 25.4 mm). Its mm notes (lift 2025 x 2025, stair width 1500) agree with the geometry at that scale.
