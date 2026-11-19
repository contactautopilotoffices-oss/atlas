# RTP 4th floor, fitted suite: what is assumed

The model is built from the fit-out drawing `20261118_4TH FLOO.dwg` (RTP 4th FLOOR, copy 2 (the fitted suite where the two wings meet); paper space: AREA : 6603 SQ.FT). Anything the drawing does not show is listed here, with where it came from. Seat counts come from the drawing's own chair blocks and are not affected by any of this.

## Heights (not in the drawing)

- **Ceiling 3.05 m clear (10 ft), soffit 3.35 m (11 ft), 3.6 m floor to floor.** Instruction from the client team, 19 Nov 2026; the drawings have no section or ceiling level.
- **This floor's finished floor level: 15.0 m above ground** (0.6 m plinth + 3.6 m x 4). The landlord's section drawing is needed to confirm the floor count and heights.
- Desks 0.75 m, partitions full height to the ceiling, glass partitions 3.05 m; standard fit-out heights.

## Position and orientation

- **North up.** The plan is turned 91.00 degrees clockwise from the drawing to true north, fitted to the building's footprint on OpenStreetMap (91 % overlap) and registered on the 185 structural columns, so the floors stack within 1 cm (median 0.0 m).
- Coordinates are metres east and north of the Google Maps pin for Reliable Tech Park, B Wing (19.16922 N, 73.00177 E).

## Look (Altruist)

- Finishes are matched to five photos of Altruist's current Noida office, not to a design for this space: charcoal 600 x 1200 reception wall with the built, backlit Altruist logo; white reception desk with a royal-blue front; dark grey 600 tiles at reception and polished beige marble in the lobbies; charcoal streaked carpet in the work halls; white desks, royal-blue fabric screens, kraft side screens, black mesh chairs; white walls with black skirting and columns; glass partitions in thin black frames with a frosted stripe band from 0.9 to 1.8 m; 600 grid ceilings with 600 LED panels and square AC diffusers; an olive fabric wall in the cabins.
- Light fittings, AC diffusers and their layout are assumed (the drawing has no ceiling plan): LED panels on a 1.8 m grid, downlights at reception, a diffuser every fourth tile.
- Daylight is a clear-sky sun for Airoli; the glass is clear; there are no blinds.
- The reception tile area is built to the outline the drawing gives it (an octagon on the 6th floor), inside the corridor carpet; the drawing does not say whether the tile runs wall to wall.
- Two downlights over the logo wall and the backlit halo of the logo letters are assumed from the Noida photos. The logo is Altruist's own wordmark (traced from their logo file), 2.3 m wide.
- The reception desk follows the Noida photo (white body, narrower royal-blue front, warm light at the plinth); its size and place are the drawing's.
- Not in the drawing, added as typical fit-out: a wall display on the end wall of meeting and conference rooms, an olive acoustic panel in the conference rooms, a display and whiteboard at the front of training rooms (left out where every spot is within 1 m of a door). Visitor chairs in reception are shown as upholstered beam seating, one seat per drawn chair.
- Ceilings get the light that bright desks, walls and people bounce up in a real office (the dark carpet bounces little): an even fill from below, unseen itself.
- The view out of the windows shows the neighbouring buildings as plain white blocks (from OpenStreetMap heights), not as photographs.
- Not built yet: airport benches (grey perforated metal) along the lobby glass: not built (no CAD block; the CAD's lobby seats are sofas).
- Not built yet: smoke detectors and sprinkler heads in the grid ceilings: not built.
- Not built yet: warm LED strip under the reception counter: not built.
- Not built yet: two downlights over the logo: the reception's plain ceiling gets assumed downlights on a 2 m grid instead.

## What the model changes from the drawing (all small, all logged)

- 45 x desks cut back where the drawing puts them into a wall (the model draws each wall line as a 70 mm solid)
- 5 x tables cut back the same way
- 0 x decor pot plants left out (they stood in the 1.2 m walkways)
- 29 x chairs moved up to 0.4 m clear of a wall or table
- 65 x chair moves of up to 30 mm so neighbouring chairs do not overlap (rows drawn at 0.57 m)
- Every desk and table is inset by 4 mm so outlines that touch in the drawing do not overlap in 3D.
- The cut edge of the offer and any gap in the facade line are closed by a plain wall (marked as assumed in the model).

## For the designer: walkways under 1.2 m (from the drawing)

**Walkways: 7 CAD pinch points (1.05–1.15 m), from the drawing.**

The model keeps the drawing's desks and walls where they are. On the routes from the entrance to every door, these 7 stretches are narrower than 1.2 m (measured on the model, between desks, tables, walls and fixed furniture; chairs are moved by people and are not counted; the model's walls are 35 mm thicker on each face than the drawn lines, so the drawn clear width is 35 to 70 mm more):

- 1.05 m over 0.6 m in Corridor 3, at (36.9, 95.7) m (wall to wall).
- 1.05 m over 2.3 m in Corridor 3, at (35.6, 95.7) m (wall to wall).
- 1.05 m over 1.9 m in Corridor 3, at (32.7, 95.7) m, between STHGSERTHESRTHSDRTH_117.
- 1.15 m over 0.7 m in Corridor 3, at (37.3, 97.9) m (wall to wall).
- 1.05 m over 4.0 m in Corridor 3, at (37.4, 102.6) m, between STHGSERTHESRTHSDRTH_60.
- 1.05 m over 3.1 m in Corridor 3, at (37.4, 106.4) m, between STHGSERTHESRTHSDRTH_81, table_1.
- 1.05 m over 2.2 m in Corridor 3, at (35.5, 95.7) m (wall to wall).

## Open points from the CAD read (G0)

- Area: the rooms measure 6,143 sq ft of free floor (-7.0 %) and 6,460 sq ft with the inner partitions (-2.2 %) against the sheet's 6,603 sq ft carpet: within 3 % only when the partitions are counted. The gross area inside the offer (6,460 sq ft, facade line to facade line) is -2.2 % from it. The sheet's chargeable area is exactly 1.500 x its carpet area, so the sheet's carpet figure looks like chargeable / 1.5 (a 50 % loading), not a measured area.
- Exits: 212 of 212 seats reach only one exit stair (S4) on the drawn walls and doors inside the walk area (the suite has no stair of its own: walking routes use the suite plus the common MAIN LOBBY in front of lift core B and its stair (to x 41.5, y 76); the other tenants' units are not walked through). A second exit route is not drawn.
- Label not placed in a room: 'store room' at (26, 105) - closed-room label in an open area: needs a closure.

## How the drawing was read (G0)

- True north: the drawing is turned 91 degrees clockwise to put north up (airoli-rtp/review/north_fit.json: CAD outline fitted to OSM way 1072909784, IoU 0.913). The sheet's own north arrow sits in paper space and was not read.
- Heights are not in the drawing (no section, no ceiling level): ceiling 2.85 m and full-height partitions are assumed; the floor-to-floor height is unknown and needs the landlord's section.
- Carpet area is measured as the free floor between walls (see the area note). The landlord's own method (for example, whether toilets, the lift lobby or wall thickness count) is not known.
- Walking distances follow the drawn walls and doors on a 0.2 m grid, with furniture ignored (people use the aisles), so they are slightly short for seats deep in a cluster. Every door is taken as usable; door direction and fire rating are not checked.
- Exit stairs are the staircases drawn on the STAIR layer and entered by their E.D. / F.D. doors. Travel limits are NBC 2016 business occupancy: 45 m with sprinklers, 30 m without; a fire consultant must confirm which applies.
- Walkway width = the clear gap between desks, tables and partitions with the chairs where they are drawn (lounge seats ignored), measured at the CAD's own passage labels.
- Daylight: distance from each work seat to the nearest facade glass line; the facade glass type, sill height and shading are not in the drawing.
- Seats are counted from chair blocks, one per chair (two per two-seat sofa). A work seat is a chair at a desk; the room a chair stands in decides meeting, training, cafeteria and lounge.
- 544 short openings without a door block (toilet entries, lift doorways, bays) were closed automatically where two wall ends face each other 0.55 to 1.15 m apart, for room outlines only; walking routes may pass through them.
