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

## The 3D site: /noida-skymark/volt/

Everything is built in the browser (three.js r169) from
`volt-floor1.layout.json`. `cad/layout.py` writes that file from the DWG.
Nothing in the layout is modelled by hand. The flow, following the two
reference videos:

1. **Building.**
   - The CAD's whole first-floor outline (Volt plus the part marked OCCUPIED,
     about 59 m x 29.5 m) is extruded as G+4 at 4.1 m floor to floor, with
     glass, fins, slabs and a roof parapet.
   - Hover a floor to see its tag. Click "First floor · Volt": the floors
     above lift away and the shell fades.
2. **Floor.**
   - The cutaway floor plate:
     - walls and partitions, cut at 1.15 m, or full height with "Walls";
     - glass with a frosted band;
     - the 31 door leaves from the CAD door blocks;
     - columns, the atrium with its rail;
     - every desk with its screen and monitor, every table, every chair facing
       its desk or table, sofas, planters and plants;
     - floor finishes by room.
   - Room tags show seat counts.
   - The room rail and Prev/Next mean you never need to zoom by hand.
3. **Room.**
   - One click flies the camera in, framed to the free part of the screen.
   - The card shows the seats and the deck's design render of that room
     (pages 4 to 22 of the 21 Aug 2026 Volt deck).
4. **Walk.**
   - First person at eye height (1.55 m), with collision against the CAD walls,
     glass, desks and tables.
   - Drag to look, use W A S D or the joystick to move, click the floor to glide.
   - The minimap jumps you to any point you tap.
5. **Tour.**
   - Starts at the street, comes in at the entrance by the lift core and fades
     through the lift to the first-floor lobby.
   - Then it visits reception, workstations, control room, sales, calling,
     cafeteria, conference, finance, lounge, director cabin and collab.
6. **Elevation.**
   - Orthographic views looking N, E, S or W, with a live section cut you can
     slide, and a height ruler (floor, desk, rail, ceiling).
7. **Time of day.**
   - The slider runs from 7 am to 10 pm and moves the sun, its colour, the sky
     and the shadows.
   - At night the facade glows and the ceiling panels light up.
   - The panels sit where the drawing's ceiling plan puts them: 2' x 2' LED
     panels and downlights.

### What is assumed

- **Heights.** The plan has no heights. These are standard values:
  - desk 0.75 m
  - ceiling 2.85 m
  - planter 0.62 m
- **Entrance.** The street entrance is placed at the lift core and marked as
  indicative, because the ground floor is not in this drawing.
- **Exterior.** The facade on this page is a plain curtain wall built from the
  CAD outline. The photo-based twin of the real facade is at
  /noida-skymark/world.

## Presenter remote

Drive the Volt floor on a big screen from a phone, without touching the display.

1. On the display, open `/noida-skymark/volt/` and choose **Remote** (or press
   P). A QR code appears. On a TV with no keyboard, open
   `/noida-skymark/volt/?present` instead: it shows the QR straight away and
   the phone's sign-in unlocks the screen.
2. Scan the QR with the phone. It opens `remote.html` with a one-time code.
3. Sign in on the phone with the same Atlas ID and password.
4. The phone now controls the display:
   - **Places:** building, entrance, the floor, every room, previous and next,
     places around the building.
   - **Walk:** the CAD drawing with your position (tap to go there), a move
     stick, a look pad, zoom.
   - **Show:** the tour, 2D plan, seats, walls, time of day, the section and
     the facades, a room's render, a pointer dot on the screen, back to start.

How it works:

- `present.js` (display) and `remote.js` (phone) talk over a Supabase Realtime
  broadcast channel, using the site's public Supabase config in `/config.js`.
  With no config (a local test) they fall back to a BroadcastChannel, which
  only reaches another tab of the same browser.
- The channel name comes from a one-time secret in the QR link. It is in the
  link's `#` part, so it is not sent to any server.
- Every message is signed. If the display was signed in at the gate, the phone
  must know the same ID and password for its messages to verify. If the
  display was unlocked by the phone (`?present`), the check is the phone's own
  sign-in plus the one-time secret. That is as strong as the atlas gate
  itself, which is also checked in the browser.
- One presenter at a time. A second phone can take control. If the phone goes
  quiet for 20 seconds the display stops any movement and frees the remote.
- Commands go through one function, `runCommand` in `volt.js`, so the remote
  can do only what the on-screen buttons can do. It cannot edit content.

Tested here in a headless browser with the local fallback link: pairing, a
room command, the state coming back to the phone, the move stick and reset.
Not yet tested: the live Supabase link between two real devices.
