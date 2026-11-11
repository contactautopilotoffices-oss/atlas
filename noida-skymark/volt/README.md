# Volt, first floor, Skymark F-1: seat proof

**Claim:** Volt is a 100-seater on the first floor.

**Answer from the drawing:** yes. Volt has **116 work seats**: each one is a
desk with a task chair, in Volt's own rooms. Counting every seat drawn on the
floor (meeting, cafeteria, lounge and the operator's rooms too), there are
**213**.

Source: `20260915_SKY_MARK_NOIDA_1ST_VOLT_ENERGY_R16.dwg` (AutoCAD 2010,
sha256 `e7d16367...d65d9b31b0a87`). The plan is titled "FIRST FLOOR PLAN".
The file holds two copies of the floor:

- the upper copy is the ceiling plan;
- the lower copy is the furniture layout, and this count uses that one.

The part of the floor marked "OCCUPIED" (west) belongs to another tenant and
is not counted.

## Work seats (desk + task chair)

| Room | Seats | What the drawing's own label says |
|---|---:|---|
| Open workstations | 48 | WORKSTATION - 48 NOS (4'0"x2'0") |
| Sales office | 33 | SALES OFFICE 33 NOS |
| Control room / command centre | 13 | CONTROL ROOM / COMMAND CENTER 12 NOS, plus 1 desk by the door |
| Calling room | 9 | CALLING ROOM 09 SEATER WS |
| Finance room | 7 | FINANCE ROOM 7 SEATES WS |
| Staff room | 4 | STAFF ROOM 4 SEATER WS |
| Director cabin 01 | 1 | |
| Director cabin 02 | 1 | |
| **Total** | **116** | |

Other seats:

| Group | Seats | Rooms |
|---|---:|---|
| Meeting rooms | 38 | 18-seater conference, two 6-seaters, two 4-seaters |
| Cafeteria | 12 | 8 chairs at two round tables, 4 stools at the counter |
| Lounge, collab and visitor seats | 41 | lounges, collab areas 01 and 02, director cabin visitor chairs, atrium-side sofas (2- and 3-seat sofas count per place) |
| Operator (not counted as Volt's) | 6 | Autopilot cabin 4, reception 2 |

## How it was counted

1. `cad/flatten.mjs` reads the DWG directly with
   [`@node-projects/acad-ts`](https://www.npmjs.com/package/@node-projects/acad-ts)
   (MIT).
   - It explodes every block into drawing coordinates.
   - It records each block instance with its name, layer, parent block and
     position.
2. `cad/inst.py` takes each instance's centre from its exploded geometry.
3. `cad/rooms.py` gives every chair block a type and puts it in a room box.
   The boxes were traced from the plan's walls. The chair block types are:
   - `A$C136922d8`: task chair;
   - `A$Cd2419d53`: meeting chair;
   - `A$Caa80c39f`: cafeteria chair;
   - and so on. `volt_seats.csv` lists each seat's block, so every one can be
     checked.
4. `cad/proof.py` draws `volt_seat_plan.png` and numbers every seat:
   - W: work
   - M: meeting
   - C: cafeteria
   - L: lounge, collab and visitor
   - O: operator

Two checks show this is not a guess:

- **The labels match the chairs.** Every count label in the drawing equals the
  number of chair blocks found in that room.
- **The desks match the chairs.** Each workstation block has exactly one task
  chair nested inside it:
  - 59 blocks of 4' x 2' (48 open, 7 finance, 4 staff);
  - 43 blocks of 3' x 2' (33 sales, 9 calling, 1 control room);
  - 3 more desks in the Autopilot cabin.

Run it again with:

```bash
node cad/flatten.mjs <the.dwg> flat.json && python3 cad/inst.py && python3 cad/rooms.py && python3 cad/proof.py
```

`flatten.mjs` expects `S` to point at a folder with acad-ts installed under
`lwtest/node_modules`. Change the import path if it lives elsewhere.
