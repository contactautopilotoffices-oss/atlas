# Skymark plate fit: where Volt, Paytm and ARCIL sit

Made by `plate_fit.py` (numbers in `plate_fit.json`, picture in `plate_fit.png`). All coordinates are
metres in **Volt's plan frame** (the frame of `volt/volt-floor1.layout.json`: x east, y north on the
drawing, origin at drawing point 2996150, -3366400 inches of the Volt DWG), unless marked as inches.

## Answer

**Volt and Paytm are side by side on the same first floor, not alternative layouts of the same space.**
Paytm's two entities occupy the part Volt's plan marks `OCCUPIED`; Volt occupies the part Paytm's plan
leaves empty. The only common ground is the east service strip (lift lobby, reception, washrooms, wet
pantry, Autopilot cabin, 06-seater meeting room), which is the operator's shared area and is drawn
identically in both files.

**ARCIL is on the second floor** (one storey up), and its `OCCUPIED SPACE` is the Altruist fit-out.

## Evidence

### 1. Same plate, same floor: Volt (R16, 15 Sep 2026) and Paytm (R-17, 11 Nov 2026)

| Shared geometry | Result |
|---|---|
| Columns | 30 of Paytm's 32 column outlines land on Volt's columns; mean residual 0.07 m, max 0.30 m, rotation -0.04 deg, x-scale 1.0008 |
| Lift labels (LIFT 2025X2025, 4) | within 0.04-0.05 m of Volt's after the fit |
| Stair cores (2) | centres within 0.04 m |
| Lift spacing west to east (raw drawing) | 1490 in in both files |
| Plate outline | IoU 0.991 with Volt's plate |
| Shift Paytm plan -> Volt frame | dx -25.281 m, dy -6.147 m (Paytm plan origin = drawing point 2997950, -3380250 in) |

### 2. Side by side, not overlapping

- Volt demise (from the live layout's `floor`): x 0.50 to 37.32, y 1.27 to 27.97; 711 m2 net of the atrium.
  Volt's 116 work seats span x 0.9 to 35.4, y 10.1 to 26.9.
- Paytm work seats (244) span x -12.2 to 12.0, y -0.3 to 27.1: ENTITY-01 (173 workstations) in the
  west block x -12.2 to 0.3, y 10.4 to 27.1 (Volt's `OCCUPIED`), ENTITY-02 (71 workstations) in the
  south-centre strip x 3.5 to 12.0, y -0.3 to 9.2, directly south of Volt's sales office and calling room (also `OCCUPIED` on
  Volt's plan). The closest Paytm and Volt work chairs are 0.6 m apart, across the sales-office wall.
- **No Paytm work seat lies inside Volt's demise.** The 15 Paytm seats that do are the shared strip:
  Autopilot cabin 4 (operator), 06-seater meeting room 6, collab chairs 5.
- Volt's main zone (open workstations, 18-seater conference, director cabins, finance, staff,
  control room, sales office) is one empty enclosed area on Paytm's plan: 564 m2, x 0.8 to 36.5,
  y 9.3 to 28.0 (excluded from Paytm's demise as unfitted; the CAD text `CARPET AREA 6720 SQFT` sits
  inside it). Volt's demise is x 0.5 to 37.3: the two outlines coincide.
- Overlap of the two demise polygons: 159 m2 (Paytm demise 974 m2 net of the atrium), all of it the east service strip above
  (x 14.8 to 37.3, y 1.3 to 9.6); its rooms on Paytm's plan: reception, Autopilot cabin, 06-seater meeting
  room, wet pantry, gents/ladies/H. washrooms, janitor's closet, electrical panel, lifts 1 and 2.

### 3. ARCIL is the second floor, drawn from a separate site survey

| Shared geometry | Result |
|---|---|
| Columns | 33 of 38 within 0.6 m of Volt's; mean residual 0.33 m, max 0.56 m, rotation +0.17 deg |
| Lift spacing west to east (raw drawing) | 1525 in (Volt and Paytm: 1490 in), i.e. 0.89 m longer |
| Lift labels after fit | 0.42 m and 0.54 m off Volt's |
| Plate | 61.96 x 30.26 m (Volt 61.23 x 29.86 m); IoU 0.958 |
| Shift ARCIL plan -> Volt frame | dx -26.213 m, dy -2.225 m, rot +0.171 deg (ARCIL plan origin = 2921050, -3343450 in) |

ARCIL's plan is titled `SECOND FLOOR PLAN / AS PER ONSITE MEASUREMENT`. Its core and columns match
the first-floor drawings only to about half a metre, and the error grows west to east (x-scale 0.988):
the second-floor base is a different survey, not the same drawing moved up. The Altruist second-floor
DWG uses the same base (lift spacing 1525 in), which supports this.

- ARCIL demise: 1,022 m2 (plate minus the two `OCCUPIED SPACE` regions, as closed by the CAD walls plus the closures listed in `tenants/arcil.json`): the full north
  band (training room, toilets, pantry, 238 workstations, two 8-pax rooms, 16-pax conference, server/UPS),
  the middle workstation band, and the east block (cabins, lockers, interview rooms, reception).
  ARCIL work seats span x -12.1 to 36.6, y 8.5 to 27.2 in the Volt frame.
- `OCCUPIED SPACE` (651 m2, exported as `not_demised`): x -21.2 to 28.1, y -0.9 to 17.0, the west,
  south-centre and centre of the second floor, up to ARCIL's locker passage. Laying the Altruist DWG on ARCIL's plan by the west lift labels puts 101 of Altruist's task
  chairs and 1 director chair inside it (Altruist's labels: WORKSTATION 59 + 41). So the occupied
  space is Altruist.

## Levels in the twin

`fit_to_twin.py` composes the column registration with Volt's own `site_fit`, so each layout carries a
`site_fit` of the same form (Paytm: rot 305.16 deg; ARCIL: rot 305.37 deg) and `storeys.level`.

- Paytm, level 1 (slab 4.1 m): same treatment as Volt; podium parts of 4, 11, 107 and 5 m2.
- ARCIL, level 2 (slab 8.2 m): above the twin's two-storey annex, so no podium. **242 m2 of ARCIL's
  floor lies outside the twin's main body at that height** (`twin_overhang` in the layout). The CAD's
  second floor runs to the street front like the first; the photo twin's main facade sits further back.
  The twin's massing needs a decision before ARCIL can be shown closed.
- The CAD stair notes give 3.9 m floor to floor (RISER-3900/25); the twin uses 4.1 m. Not changed here.

## Caveats

- Volt's 36 columns come from re-running the generic pipeline on the Volt DWG (the live layout keeps
  only the 20 inside Volt's own window); same frame, same origin.
- "Demise" here is read from the drawing: plate minus atrium minus areas marked `OCCUPIED` or left
  unfitted. Paytm's demise therefore includes the shared east strip; it is not a lease line.
