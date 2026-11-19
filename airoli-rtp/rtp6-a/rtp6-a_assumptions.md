# RTP 6th floor, Option A (Units 601 & 602): what is assumed

The model is built from the fit-out drawing `20261118_6TH FLOOR.dwg` (6TH FLOOR PLAN, Option 01, Details for Unit 601 & 602 (Team One Arteq, 03.10.2020)). Anything the drawing does not show is listed here, with where it came from. Seat counts come from the drawing's own chair blocks and are not affected by any of this.

## Heights (not in the drawing)

- **Ceiling 3.05 m clear (10 ft), soffit 3.35 m (11 ft), 3.6 m floor to floor.** Instruction from the client team, 19 Nov 2026; the drawings have no section or ceiling level.
- **This floor's finished floor level: 22.2 m above ground** (0.6 m plinth + 3.6 m x 6). The landlord's section drawing is needed to confirm the floor count and heights.
- Desks 0.75 m, partitions full height to the ceiling, glass partitions 3.05 m; standard fit-out heights.

## Position and orientation

- **North up.** The plan is turned 91.00 degrees clockwise from the drawing to true north, fitted to the building's footprint on OpenStreetMap (91 % overlap) and registered on the 185 structural columns, so the floors stack within 1 cm (median 0.008 m).
- Coordinates are metres east and north of the Google Maps pin for Reliable Tech Park, B Wing (19.16922 N, 73.00177 E).

## Look (Altruist)

- Finishes are matched to five photos of Altruist's current Noida office, not to a design for this space: charcoal 600 x 1200 reception wall with the built, backlit Altruist logo; white reception desk with a royal-blue front; dark grey 600 tiles at reception and polished beige marble in the lobbies; charcoal streaked carpet in the work halls; white desks, royal-blue fabric screens, kraft side screens, black mesh chairs; white walls with black skirting and columns; glass partitions in thin black frames with a frosted stripe band from 0.9 to 1.8 m; 600 grid ceilings with 600 LED panels and square AC diffusers; an olive fabric wall in the cabins.
- Light fittings, AC diffusers and their layout are assumed (the drawing has no ceiling plan): LED panels on a 1.8 m grid, downlights at reception, a diffuser every fourth tile.
- Daylight is a clear-sky sun for Airoli; the glass is clear; there are no blinds.
- The reception tile area is built to the outline the drawing gives it (an octagon on the 6th floor), inside the corridor carpet; the drawing does not say whether the tile runs wall to wall.
- Two downlights over the logo wall and the backlit halo of the logo letters are assumed from the Noida photos.
- The view out of the windows shows the neighbouring buildings as plain white blocks (from OpenStreetMap heights), not as photographs.
- Not built yet: airport benches (grey perforated metal) along the lobby glass: not built (no CAD block; the CAD's lobby seats are sofas).
- Not built yet: smoke detectors and sprinkler heads in the grid ceilings: not built.
- Not built yet: warm LED strip under the reception counter: not built.
- Not built yet: two downlights over the logo: the reception's plain ceiling gets assumed downlights on a 2 m grid instead.

## What the model changes from the drawing (all small, all logged)

- 9 x desks cut back where the drawing puts them into a wall (the model draws each wall line as a 70 mm solid)
- 23 x tables cut back the same way
- 19 x basins and urinals moved off the wall face (the 3D fittings are deeper than the drawing symbols)
- 12 x basins or urinals left out because the drawing places them inside a wall
- 7 x washroom fittings moved out of a wall
- 5 x decor pot plants left out (they stood in the 1.2 m walkways)
- 120 x chairs moved up to 0.4 m clear of a wall or table
- 3 x chairs that could not be moved clear (their table gave way instead)
- 3 x tables trimmed by up to 30 mm so a chair fits
- 217 x chair moves of up to 30 mm so neighbouring chairs do not overlap (rows drawn at 0.57 m)
- Every desk and table is inset by 4 mm so outlines that touch in the drawing do not overlap in 3D.
- The cut edge of the offer and any gap in the facade line are closed by a plain wall (marked as assumed in the model).

## For the designer: walkways under 1.2 m (from the drawing)

**Walkways: 5 CAD pinch points (0.85–1.15 m), from the drawing.**

The model keeps the drawing's desks and walls where they are. On the routes from the entrance to every door, these 5 stretches are narrower than 1.2 m (measured on the model, between desks, tables, walls and fixed furniture; chairs are moved by people and are not counted; the model's walls are 35 mm thicker on each face than the drawn lines, so the drawn clear width is 35 to 70 mm more):

- 1.05 m over 0.9 m in Corridor 11, at (-43.9, 108.7) m (wall to wall).
- 0.85 m over 1.8 m in Open workstations 2, at (-38.9, 108.7) m, between deskpoly_172, deskpoly_173.
- 0.85 m over 2.3 m in Open workstations 2, at (-42.0, 95.5) m, between deskpoly_19, deskpoly_20.
- 1.15 m over 0.4 m in Corridor 8, at (-8.2, 87.5) m, between deskpoly_107, deskpoly_108.
- 1.05 m over 1.8 m in Corridor 11, at (-42.4, 110.0) m (wall to wall).

## Open points from the CAD read (G0)

- Legend '02/04 MEETING ROOM': sheet says 4 provided (2 required); the CAD shows 3. meeting rooms with 2-5 chairs: MEETING ROOM 04 PAX (1) (4), MEETING ROOM 04 PAX (unlabelled) (3), MEETING ROOM 04 PAX (2) (4)
- Legend 'BOARD ROOM': sheet says 1 provided (1 required); the CAD shows 0. CAD labels: none
- Legend 'CEO CABIN': sheet says 1 provided (1 required); the CAD shows 0. CAD labels: none
- Legend 'REPRO': sheet says 2 provided (1 required); the CAD shows 6. CAD labels: PRINTER (13, 80), REPRO AREA (13, 82), REPRO (27, 56), REPRO (16, 79), REPRO (17, 67), REPRO (17, 31)
- Legend 'TRAINING ROOM': sheet says 1 provided (1 required); the CAD shows 2. CAD labels: TRAINING ROOM (33, 22), TRAINING-STYLE ROOM (unlabelled) (34, 80)
- Legend 'LADIES WASHROOM': sheet says 2 provided (1 required); the CAD shows 3. CAD labels: LADIES TOILET (14, 37), LADIES TOILET (14, 64), LADIES TOILET (15, 21)
- Area: the rooms measure 29,856 sq ft of free floor (+26.2 %) and 31,982 sq ft with the inner partitions (+35.2 %) against the sheet's 23,659 sq ft carpet: outside the 3 % rule on both counts. The sheet's chargeable 35,488 sq ft is -3.0 % from that gross area. The sheet's chargeable area is exactly 1.500 x its carpet area, so the sheet's carpet figure looks like chargeable / 1.5 (a 50 % loading), not a measured area.
- Exits: 112 seats in CAFETERIA (1) reach only one exit stair on the drawn walls and doors (a second route was not found). Check for a door missing from the drawing.
- Entry: the lift bank at (33, 51) (2 lifts, LOBBY (29.4, 50.8)) has no walking route to the reception on the drawn doors.
- Walkway: '1200 MM WIDE PASSAGE' at (18, 40) measures 0.98 m between chairs at their desks (median of 5 points; 2.06 m desk to desk).
- Walkway: '1350 MM WIDE PASSAGE' at (18, 80) measures 0.99 m between chairs at their desks (median of 5 points; 3.14 m desk to desk).
- Capacity: 'MEETING ROOM 04 PAX (unlabelled)' says 4; 3 chairs are drawn in it.
- Label not placed in a room: 'SPACE FOR OUTDOOR UNIT' at (12, 42) - closed-room label in an open area: needs a closure.
- Label not placed in a room: 'SPACE FOR OUTDOOR UNIT' at (12, 60) - closed-room label in an open area: needs a closure.
- Label not placed in a room: 'REPRO' at (27, 56) - closed-room label in an open area: needs a closure.
- Label not placed in a room: 'REPRO' at (16, 79) - closed-room label in an open area: needs a closure.

## How the drawing was read (G0)

- True north: the drawing is turned 91 degrees clockwise to put north up (airoli-rtp/review/north_fit.json: CAD outline fitted to OSM way 1072909784, IoU 0.913). The sheet's own north arrow sits in paper space and was not read.
- Heights are not in the drawing (no section, no ceiling level): ceiling 2.85 m and full-height partitions are assumed; the floor-to-floor height is unknown and needs the landlord's section.
- Carpet area is measured as the free floor between walls (see the area note). The landlord's own method (for example, whether toilets, the lift lobby or wall thickness count) is not known.
- Walking distances follow the drawn walls and doors on a 0.2 m grid, with furniture ignored (people use the aisles), so they are slightly short for seats deep in a cluster. Every door is taken as usable; door direction and fire rating are not checked.
- Exit stairs are the staircases drawn on the STAIR layer and entered by their E.D. / F.D. doors. Travel limits are NBC 2016 business occupancy: 45 m with sprinklers, 30 m without; a fire consultant must confirm which applies.
- Walkway width = the clear gap between desks, tables and partitions with the chairs where they are drawn (lounge seats ignored), measured at the CAD's own passage labels.
- Daylight: distance from each work seat to the nearest facade glass line; the facade glass type, sill height and shading are not in the drawing.
- Seats are counted from chair blocks, one per chair (two per two-seat sofa). A work seat is a chair at a desk; the room a chair stands in decides meeting, training, cafeteria and lounge.
- 484 short openings without a door block (toilet entries, lift doorways, bays) were closed automatically where two wall ends face each other 0.55 to 1.15 m apart, for room outlines only; walking routes may pass through them.
