# Reliable Tech Park, B Wing, Airoli: plan for G0 (CAD read) and G1 (2D plan)

Draft, 19 Nov 2026. Nothing is built yet. This file records what the two drawings contain and how each
number will be produced and checked, and it sets out what we propose to show the client, before any
modelling starts.

Inputs: `20261118_4TH FLOO.dwg`, `20261118_6TH FLOOR.dwg` (both AutoCAD 2018 format, millimetres), and the
Google Maps pin for Reliable Tech Park, B Wing, Thane-Belapur Road, MIDC Airoli, Navi Mumbai 400708.
Raw previews of the plans are in `review/`. They are local only; images are not committed.

## 1. What the drawings contain (first read)

The building is one L-shaped plate, about 140 m x 114 m, with rounded ends. **True north is solved:**
the CAD's "up" is true east, so turn the drawing 91 degrees clockwise to put north up
(`EXTERIOR_PLAN.md`, section 1). Directions below are true directions. The drawings label lift cores
A, B and C and cores 1 to 4. Each file holds **two copies of the plan** side by side, so the first job is
to split them and agree which one is the offer.

| File | Copy | What it is | Area on the sheet | Raw seat signal |
| --- | --- | --- | --- | --- |
| 4th floor | 1 | Bare shell of the whole floor, with other units labelled: 402 IDEA, 402 TRIMAX, 403 A, 403 B Times of Money, 404 CGG Veritas | — | none |
| 4th floor | 2 | The same floor with one suite fitted in the corner where the two wings meet: 5 training rooms, a 12-seat conference room, two 6-seat meeting rooms, interview cabins, an HR induction room, admin, HR and IT rooms, reception, main lobby | Carpet 6,603 sq ft, chargeable 9,905 sq ft | Chairs are inside unnamed furniture groups, so the count is still pending |
| 6th floor | A | Sheet "Option 01, Units 601 & 602", Team One Arteq, **dated 3 Oct 2020**. The true-north arm is fitted (the CAD's left arm, rounded end to the west); the long true-east arm (603, 604) is empty | Carpet 23,659 sq ft, chargeable 35,488 sq ft | Legend: 429 workstations of 4' x 2' provided against 450 required. 462 chair blocks in all |
| 6th floor | B | A second fit: the west end of the north arm as in A, plus the long east arm fitted (60-seat call centre, board room, locker room, hub room, cabins, meeting rooms); the inner part of the north arm left open | Not stated | 748 chair blocks |

The 6th-floor legend (required / provided): reception 1/1, 2-4 seat meeting 2/4, 6-8 seat meeting 2/4,
board room 1/1, cabins **6/2**, CEO cabin 1/1, telephone booth 0/1, repro 1/2, training 1/1, UPS 1/1,
server 1/1, store 1/3, cafeteria 1/1, gents washrooms 1/3, ladies washrooms 1/2, workstations **450/429**.

A first ratio: 23,659 sq ft carpet / 429 workstations = **55 sq ft of carpet per workstation**
(83 sq ft chargeable), which is right on our 55 sq ft benchmark. The building's loading is about 50 %
(carpet is 67 % of chargeable) on both floors.

### Flags already

1. **The drawings are old.** The 6th is a 2020 layout. The 4th names tenants (IDEA, Trimax, Times of
   Money, CGG Veritas) that may have moved out. We need the current availability for each floor from
   the landlord before anything is called "available".
2. **Two plans per file.** Which copy is the offer: 6th A, 6th B, or the whole floor?
3. **Who is the brief?** The 2020 legend is someone's old requirement (450 desks, 6 cabins). Is there a
   2026 client brief, or do we present the space with the old fit as one option?
4. **"B Wing".** The pin says B Wing, but the drawing is the whole L, with cores A, B and C. Confirm
   which part is B Wing, and whether the 4th and 6th offers sit in it.

## 2. G0: CAD read, and how each number is produced

This reuses the generic Skymark pipeline (`noida-skymark/cad/`) with a building file for this site.
Four things are new for these drawings: splitting several plans in one file, reading the paper-space
legend table, egress analysis, and north from the real footprint.

| Item | How it is measured | Cross-check | Pass rule |
| --- | --- | --- | --- |
| **Seats** | Every chair block instance, placed in its room polygon and paired with a desk; grouped as work, meeting, training, cafe, lounge, call centre | The sheet legend (429 workstations) and desk count = work-chair count | The CAD count equals the legend line by line, or each difference is listed with its location |
| **Areas** | Room polygons closed from wall, glass and door lines; area per room and per use | Sheet totals (23,659 / 6,603 sq ft carpet); the CAD's own toilet areas (247, 163 sq ft) | Room areas add up to the carpet area within 3 % |
| **Density** | Carpet and chargeable area per seat, per workstation, per use | Our tier rules (55 sq ft per seat, 3-hop rule) | Reported, not passed or failed |
| **Direction (true north)** | Fit the L-shaped outline to the real building footprint (OSM / Overture) at the Maps pin. The footprint's shape is distinctive, so the fit is unambiguous | The north arrow on the paper sheet ("N / DIRECTION"), allowing for any rotation of the sheet's viewport | Both agree within 5 degrees |
| **Entry points** | Lift wells, lift lobbies and the main lobby from labels and the core layer; the tenant's front door is the door between a lift lobby and reception | Labels: LOBBY, MAIN LOBBY, RECEPTION & WAITING, LIFT CORE A/B/C | Each suite has one clear front door and a lift lobby |
| **Exit points** | Staircases (STAIR layer, "UP"), doors marked E.D. and F.D., FIRE EXIT, fire-rescue balconies | Every exit stair reaches the plate edge or a core | Every seat has two exits; the walking distance from each seat to the nearest exit is mapped and compared with NBC 2016 limits (to be confirmed with a fire consultant) |
| **Walkways** | Widest-path routes from the front door to every room | The CAD's own labels: 1,200 / 1,350 / 1,500 / 1,700 mm WIDE PASSAGE | The measured width matches each label; nothing under 1.2 m |
| **Room uses** | Room name to use (work, meeting, training, cafe, wellness, support, core, service) | Legend lines | Every closed room has a use; unlabelled rooms are listed |
| **Daylight and views** | Each desk's distance to the facade glazing, and which way it faces (needs north) | Glazing layers (STRUCTURAL GLAZING, WINDOW) | Reported: share of desks within 6 m of a window, by facade |
| **Assumptions** | Everything not in the CAD (ceiling height, floor-to-floor height, slab, the facade beyond the glass line) | — | Listed on the sign-off sheet in plain English |

The **G0 sign-off sheet** (one page per floor option) shows the seat table against the legend, the area
table, the north arrow and how it was fitted, the entry and exit map, the flags, and the assumptions.

## 3. G1: the 2D plan sign-off sheet

One clean plan per floor option, drawn by us from the CAD (not the CAD itself):

- Rooms filled by use, in one calm palette; seats as dots coloured by type.
- North arrow, the sun's path for the morning and afternoon, and the road side (Thane-Belapur Road).
- Arrival route: lift lobby → reception → work hall, with the walking distance.
- Egress overlay: two routes from the farthest desk to two different stairs, with distances.
- A side panel with total seats, sq ft per seat, share of desks near a window, meeting rooms per
  100 seats, and the cafe's capacity as a share of headcount.
- Callouts for what we recommend highlighting (section 4).

The 2D plan is also where Langflow (CAD_OS) can propose alternative fits against a 2026 brief, for
example the whole 6th floor at 55 sq ft per seat. Its validator rules (1.2 m walkways, exits, density)
are the same as G0's, so a proposal that breaks a rule never reaches you.

## 4. What we think will make the client say "wow" (for your sign-off)

Ranked by impact for a large occupier:

1. **Scale in one look.** The full L at 140 m, with 429+ desks lit up. A whole-floor footprint under
   one roof is the headline.
2. **The 55 sq ft story.** Density shown as a number, plus a heat map of space per seat across the plate.
3. **Arrival.** Lift lobby, reception and the first view of the work hall: the first 30 seconds of
   their employees' day.
4. **Light and orientation.** Which desks get daylight and morning sun, and what each facade looks out on.
5. **Safety, made calm.** Egress shown as two clean routes per zone. Large occupiers' facility teams
   check this first.
6. **Amenity per head.** The cafeteria (with kitchen and veg and non-veg counters), training,
   wellness and lockers, shown as capacity per 100 staff.

## 5. The end goal: from the elevation to the floor plate

Planned now, so that G0 and G1 collect the data it needs:

1. **Elevation.** The real building, front-on and then in a slow orbit, with its floors as glass bands.
   The offered floors glow softly; the rest stay neutral.
2. **The floor opens.** Clicking a floor slides its plate out of the facade, like a drawer, and lifts
   it. The floors above fade away, the facade on that floor turns to clear glass, and the plate settles
   level in front of the building.
3. **The plate explains itself.** Walls rise to about 1.2 m (a doll's-house cut), rooms fill with their
   use colours one group at a time (arrival, then work, collaboration, amenities, support), and labels
   and seat counts appear only for the group in focus.
4. **Drill down.** Click a zone to go in at eye level, which is the baked Blender walkthrough at later
   gates. The 2D plan inset with "you are here" stays on screen.
5. **Compare.** On the 6th, option A and option B as two plates that swap in place, with their numbers
   side by side.

Data this needs beyond the floor plans: the number of floors and floor-to-floor height (a section or
elevation drawing, or the landlord's brochure), facade photos or elevation drawings, the footprint and
height from OSM or Overture, and the neighbouring buildings for context. The way the plate opens and
the colour language would be agreed at G3 (look), not now.

## 6. Order of work

1. Split each DWG into its plans, and agree which plan is the offer (needs your answer).
2. G0 run for 6th A first (it has a legend to prove against), then 6th B and the 4th-floor suite.
3. North from the footprint fit; entries, exits and egress distances; daylight per desk.
4. G0 sheets → your sign-off.
5. G1 plans with the wow callouts → your sign-off.
6. Only then: the elevation and the plate-opening viewer (G2 onward).

## Open questions for the founder

1. Which plan is the offer: 6th A (601 + 602), 6th B, the whole 6th, and the 4th-floor suite as drawn?
2. Is there a 2026 client brief (headcount, cabins, meeting rooms), or do we present the 2020 fit?
3. Current availability for the 4th and 6th floors (the drawings name old tenants).
4. Can the landlord share an elevation or section drawing, the floor count and floor-to-floor height?
5. Which part of the L is B Wing?
