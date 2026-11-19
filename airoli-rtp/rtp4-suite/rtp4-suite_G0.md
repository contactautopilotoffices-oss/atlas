# G0 sign-off sheet: RTP 4th floor, fitted suite

CAD read of `20261118_4TH FLOO.dwg` (RTP 4th FLOOR, copy 2 (the fitted suite where the two wings meet); paper space: AREA : 6603 SQ.FT). Reliable Tech Park, B Wing, Thane-Belapur Road, MIDC Airoli, Navi Mumbai 400708.
Image: `rtp4-suite_G0.png` (true north up). Numbers: `rtp4-suite_G0.json`.

## Headline

- **18 work seats, 212 seats in all.** Work (desk + chair) 18, Meeting 28, Training 135, Reception, lounge, visitor 31.
- **Area:** measured carpet 571 m2 (6,143 sq ft) of free floor, 6,460 sq ft with the inner partitions, against the sheet's 6,603 sq ft: -7.0 % / -2.2 %: pass only with partitions on the 3 % rule.
- **Exits:** 1 exit stairs reached; 0 of 212 seats have two. Nearest exit: median 28 m, worst 40 m.
- **Daylight:** 100 % of work seats within 6 m of a window.
- **Flags:** 3 differences or open points (below).

## Seats

| Group | Seats | Where |
|---|---:|---|
| Work (desk + chair) | 18 | ADMIN ROOM 9, HR ROOM 9 |
| Meeting | 28 | 12 SEATER CONFERENCE ROOM_01 12, 06 SEATER MEETING ROOM 01 (2) 6, 06 SEATER MEETING ROOM 01 (1) 6, INTERVIEW CABIN_02 2, INTERVIEW CABIN_01 2 |
| Training | 135 | TRAINING ROOM_02 22, TRAINING ROOM_01 22, TRAINING ROOM_03 21, TRAINING ROOM_04 21, TRAINING ROOM_06 21, TRAINING ROOM_05 19, HR INDUCTION ROOM 9 |
| Reception, lounge, visitor | 31 | RECEPTION AND WAITING 31 |

## Areas

measured carpet = every closed room, open-plan zone and circulation polygon inside the offer, except lift wells, stairs, shafts, lift lobbies and fire-rescue balconies (kind "core"); inner partitions and columns are not counted (the polygons are the free floor between them). Gross = the plate outline inside the offer.

| Use | m2 | sq ft |
|---|---:|---:|
| training | 247 | 2,658 |
| circulation | 106 | 1,140 |
| service | 67 | 718 |
| meeting | 40 | 432 |
| other | 38 | 404 |
| reception | 32 | 347 |
| work | 30 | 322 |
| cabin | 11 | 123 |
| **Measured carpet, free floor (all but core)** | **571** | **6,143** |
| Measured carpet with inner partitions (gross less cores) | 600 | 6,460 |
| Gross plate inside the offer | 600 | 6,460 |

Sheet: carpet 6,603 sq ft, chargeable 9,905 sq ft (chargeable / carpet = 1.5001). Source: carpet: paper-space text 'AREA : 6603 SQ.FT'; chargeable 9,905 sq ft is quoted in airoli-rtp/PLAN.md and is not in the DWG text. Free floor vs sheet carpet: **-7.0 %** (fail against the 3 % rule); with the inner partitions (6,460 sq ft): **-2.2 %** (pass); gross inside the offer: -2.2 %. Gross vs chargeable: -34.8 %.

## Entries

- Lift bank of 4 at (29, 79): 16 m walk to the reception; no door on the way (the reception is open to it).
- Lift bank of 4 at (36, 87): 13 m walk to the reception; no door on the way (the reception is open to it).
- Reception: RECEPTION AND WAITING at (24, 89), 32 m2.

## Exits and walking distances

Walkable floor: the offer (plate minus `not_demised`, minus lift wells and shafts), less a 0.15 m band round every wall, glass and column line. Furniture is not an obstacle (people walk the aisles; the distances are slightly optimistic for seats deep in a desk cluster). Distances are shortest paths on a 0.2 m grid with 8-way moves (straight 0.2 m, diagonal 0.283 m), so they follow corridors and doors, never through walls. The 0.3 m wall band is wider than a diagonal step, so a path can never hop a wall.

| Exit | Where | Doors / labels | Reached from this plan |
|---|---|---|---|
| S1 | (110, 105) | F.D. (107.6, 107.5), E.D. (107.0, 103.6), E.D. (107.0, 103.6), F.D. (107.6, 107.5), E.D. (107.0, 103.6), E.D. (107.0, 103.6) | no |
| S2 | (56, 105) | E.D. (58.2, 103.5), F.D. (57.8, 107.5), E.D. (58.2, 103.5), E.D. (58.2, 103.5), F.D. (57.8, 107.5), E.D. (58.2, 103.5) | no |
| S3 | (129, 82) | F.D. (128.6, 78.4), F.D. (128.6, 78.4) | no |
| S4 | (37, 79) | E.D. (33.1, 78.9), F.D. (36.9, 82.6), E.D. (33.1, 78.9), F.D. (36.9, 82.6) | yes |
| S5 | (83, 79) | E.D (77.5, 77.4), E.D (87.8, 77.4), F.D. (81.3, 82.8), E.D. (83.8, 82.8), E.D (77.5, 77.4), E.D (87.8, 77.4), F.D. (81.3, 82.8), E.D. (83.8, 82.8) | no |
| S6 | (12, 65) | E.D. (11.8, 68.1), F.D. (10.8, 68.1), E.D. (11.8, 68.1), F.D. (10.8, 68.1) | no |
| S7 | (37, 46) | E.D (38.4, 40.7), E.D (38.4, 51.1), F.D. (32.9, 44.9), E.D. (32.9, 46.9), E.D (38.4, 40.7), E.D (38.4, 51.1), F.D. (32.9, 44.9), E.D. (32.9, 46.9) | no |
| S8 | (12, 27) | F.D. (9.0, 23.8), F.D. (9.0, 23.8), E.D. (12.6, 23.3), F.D. (9.0, 23.8), F.D. (9.0, 23.8), E.D. (12.6, 23.3) | no |
| S9 | (14, 12) | F.D. (10.7, 12.8), E.D. (15.7, 10.1), F.D. (10.7, 12.8), E.D. (15.7, 10.1) | no |

- Seats with two exits: **0 of 212**; with one only: 212 (ADMIN ROOM 9, HR ROOM 9, 12 SEATER CONFERENCE ROOM_01 12, INTERVIEW CABIN_02 2, INTERVIEW CABIN_01 2, 06 SEATER MEETING ROOM 01 (2) 6, 06 SEATER MEETING ROOM 01 (1) 6, TRAINING ROOM_05 19, TRAINING ROOM_02 22, TRAINING ROOM_01 22, TRAINING ROOM_03 21, TRAINING ROOM_04 21, TRAINING ROOM_06 21, HR INDUCTION ROOM 9, RECEPTION AND WAITING 31); with none: 0.
- Walk to the nearest exit: median 27.5 m, worst 39.5 m. To the second exit: median 0.0 m, worst 0.0 m.
- Farthest seat: T1 in TRAINING ROOM_05, 39.5 m to S4 and None m to None.
- NBC 2016 Part 4, Table 5: business occupancy (Group E), travel distance to an exit 45 m with sprinklers in the whole building (30 m without). To be confirmed with a fire consultant.
- Fire exit doors: none. Fire-rescue balconies (fire-fighter access, not exits): none.
- Every seat's two nearest exits and distances: `rtp4-suite_egress.csv`; heat map: `rtp4-suite_egress.png`.

## Walkways

clear width = shortest chord through the point between walls, glass, columns, desks, tables and the work, meeting and training chairs as drawn at their desks (lounge seats ignored); desk_to_desk_m ignores the chairs; tolerance max(100 mm, 8 %)

| CAD label | At | Label (m) | Measured, chairs at desks (m) | Desk to desk (m) | At least as wide? |
|---|---|---:|---:|---:|---|

Pinch points under 1.2 m found on circulation centrelines (door openings excluded): 8 of 58 sample points: 1.20 m at (24, 97); 1.20 m at (22, 97); 1.20 m at (22, 97); 1.20 m at (18, 97); 1.20 m at (18, 97); 1.20 m at (16, 97); 1.20 m at (27, 95); 0.78 m at (29, 89). Most are strips along the facade or beside a column, not walking routes; they are listed for the G1 check.

## Daylight by true facade

distance from each work seat to the nearest facade glass line on the plate edge; facade direction = outward normal of the plate edge there, turned to true bearings by the north fit.

- 18 of 18 work seats (100 %) are within 6 m of facade glass. By facade: N 18.
- Nearest facade for all work seats: N 18. Median distance to glass 4.38 m, farthest 5.51 m.
- Glazed facade length inside the offer (m): N 26, E 24, NE 0.

## Flags and differences

1. Area: the rooms measure 6,143 sq ft of free floor (-7.0 %) and 6,460 sq ft with the inner partitions (-2.2 %) against the sheet's 6,603 sq ft carpet: within 3 % only when the partitions are counted. The gross area inside the offer (6,460 sq ft, facade line to facade line) is -2.2 % from it. The sheet's chargeable area is exactly 1.500 x its carpet area, so the sheet's carpet figure looks like chargeable / 1.5 (a 50 % loading), not a measured area.
2. Exits: 212 of 212 seats reach only one exit stair (S4) on the drawn walls and doors inside the walk area (the suite has no stair of its own: walking routes use the suite plus the common MAIN LOBBY in front of lift core B and its stair (to x 41.5, y 76); the other tenants' units are not walked through). A second exit route is not drawn.
3. Label not placed in a room: 'store room' at (26, 105) - closed-room label in an open area: needs a closure.

## Hand fixes (each one is in the plan file with its reason)

- Offer outline: the fitted suite as drawn: its partitions, the toilet-block wall to the south and the main lobby's glass line to the south-east; the rest of the 4th floor (units 402, 403 B, 404 and the main lobby) is not part of it
- Chair position: A$C9bee9767 (30 chairs) is drawn with ellipse arcs that the DWG reader explodes 2.6 x 2.3 m wide; the insertion points are 0.57 m apart in rows, so each chair is placed at its insertion point
- 544 automatic closures of short door-less openings (room outlines only).

## Assumptions

- True north: the drawing is turned 91 degrees clockwise to put north up (airoli-rtp/review/north_fit.json: CAD outline fitted to OSM way 1072909784, IoU 0.913). The sheet's own north arrow sits in paper space and was not read.
- Heights are not in the drawing (no section, no ceiling level): ceiling 2.85 m and full-height partitions are assumed; the floor-to-floor height is unknown and needs the landlord's section.
- Carpet area is measured as the free floor between walls (see the area note). The landlord's own method (for example, whether toilets, the lift lobby or wall thickness count) is not known.
- Walking distances follow the drawn walls and doors on a 0.2 m grid, with furniture ignored (people use the aisles), so they are slightly short for seats deep in a cluster. Every door is taken as usable; door direction and fire rating are not checked.
- Exit stairs are the staircases drawn on the STAIR layer and entered by their E.D. / F.D. doors. Travel limits are NBC 2016 business occupancy: 45 m with sprinklers, 30 m without; a fire consultant must confirm which applies.
- Walkway width = the clear gap between desks, tables and partitions with the chairs where they are drawn (lounge seats ignored), measured at the CAD's own passage labels.
- Daylight: distance from each work seat to the nearest facade glass line; the facade glass type, sill height and shading are not in the drawing.
- Seats are counted from chair blocks, one per chair (two per two-seat sofa). A work seat is a chair at a desk; the room a chair stands in decides meeting, training, cafeteria and lounge.
- 544 short openings without a door block (toilet entries, lift doorways, bays) were closed automatically where two wall ends face each other 0.55 to 1.15 m apart, for room outlines only; walking routes may pass through them.

## Sign-off

- [ ] Seats and legend accepted, or differences explained
- [ ] Areas accepted (or the landlord's area method requested)
- [ ] Entries and exits accepted (flags sent to the designer)
- [ ] Assumptions accepted

G1 (the 2D plan) starts only after this sheet is signed off.
