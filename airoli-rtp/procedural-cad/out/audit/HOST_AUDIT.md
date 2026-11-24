# Door hosting audit (observer review, 20 Nov 2026)

Every door is compared with the earlier run (block-edge search plus the cubicle own-panel fallback), door by door, by its door-block insert handle. An earlier host is tested against the door swing the drawing actually draws. Walls are matched by id and centre line, because a line inside a block carries the handle of the block *definition*, shared by every insert of that block.

## Where the doors stand now

- 97 door blocks in 603/604. **58 hosted**: all of them sit in a gap the drawing leaves between wall ends. True wall voids, where a wall is drawn continuous across the door and must be cut: **0**.
- **39 doors are built freestanding**, on their drawn swing line, with no host wall. No wall is invented and no host is forced. Why:
  - 4 x Glass Door block on DR-GLASS: no wall piece ends at its drawn swing
  - 6 x D-750: no wall piece ends at its drawn swing
  - 8 x DOOR_SNGL: no wall piece ends at its drawn swing
  - 20 x cubicle door: the drawn gap is in the cubicle side, where the only drawn pieces are 20 x 79 mm stubs (too short to be read as walls)
  - 1 x A$C03859404: no wall piece ends at its drawn swing
- Headers: 76 header pieces built (35 pop bulkhead, 9 lintel masonry, 32 glass transom); 21 doors have nothing above them by rule (cubicles; a cubicle has no wall above its door).
- Frames: 86 from jamb sections drawn in the block, 11 default.
- Closed side of the swing decided by tie-break (low confidence): none.
- Unresolved associations: 39 (the freestanding doors above). Their headers and leaves are built, but no wall is linked in IFC.

## The 22 doors that lost their earlier host

| Door | Block (insert handle) | Earlier host | Earlier host vs the drawn swing | Verdict |
|---|---|---|---|---|
| D068 | `DOOR_SNGL` (8283F018) | W0233 (window_glazing, handles 82833B1A, 82833E74) | not in line with the drawn opening: offset 1.036 m, gap 0.593 m; its own earlier opening: not in line with the drawn opening | earlier host was wrong: it is not in line with the drawn door swing |
| D074 | `A$C9e4b0bea` (8284043F) | W0394 (brick_block, handles 8283DD69, 8283DD9F) | not in line with the drawn opening: offset 0.923 m, gap 1.348 m; its own earlier opening: ends at the drawn opening (flank) | earlier host was wrong: it is not in line with the drawn door swing |
| D075 | `A$C9e4b0bea` (82840440) | W0403 (brick_block, handles 828404BA, 8283DD9F) | not in line with the drawn opening: offset 1.423 m, gap 0.013 m; its own earlier opening: runs through the drawn opening | earlier host was wrong: it is not in line with the drawn door swing |
| D076 | `A$C9e4b0bea` (82840449) | W0403 (brick_block, handles 828404BA, 8283DD9F) | not in line with the drawn opening: offset 1.423 m, gap 0.0 m; its own earlier opening: runs through the drawn opening | earlier host was wrong: it is not in line with the drawn door swing |
| D077 | `A$C9e4b0bea` (8284044A) | W0462 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.85 m, gap 0.021 m; its own earlier opening: not in line with the drawn opening | earlier host was wrong: it is not in line with the drawn door swing |
| D078 | `A$C9e4b0bea` (8284044B) | W0465 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.85 m, gap 0.021 m; its own earlier opening: not in line with the drawn opening | earlier host was wrong: it is not in line with the drawn door swing |
| D079 | `A$C9e4b0bea` (8284044C) | W0466 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.85 m, gap 0.021 m; its own earlier opening: not in line with the drawn opening | earlier host was wrong: it is not in line with the drawn door swing |
| D080 | `A$C9e4b0bea` (8284044D) | W0404 (brick_block, handles 8283DD9F, 8283DDA0, 8283DDA1) | not in line with the drawn opening: offset 1.423 m, gap 0.386 m; its own earlier opening: ends at the drawn opening (flank) | earlier host was wrong: it is not in line with the drawn door swing |
| D081 | `A$C9e4b0bea` (828404A6) | W0469 (panel_partial_height, handles 82840412, 82840412) | not in line with the drawn opening: offset 0.941 m, gap 0.021 m; its own earlier opening: lies inside the drawn opening (would be eaten by the cut) | earlier host was wrong: the earlier opening covered the whole wall and the cut destroyed it |
| D082 | `A$C9e4b0bea` (828404C0) | W0475 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.941 m, gap 0.021 m; its own earlier opening: lies inside the drawn opening (would be eaten by the cut) | earlier host was wrong: the earlier opening covered the whole wall and the cut destroyed it |
| D083 | `A$C9e4b0bea` (828404C1) | W0472 (brick_block, handles 828404B7, 828404BA) | not in line with the drawn opening: offset 1.424 m, gap 0.0 m; its own earlier opening: lies inside the drawn opening (would be eaten by the cut) | earlier host was wrong: the earlier opening covered the whole wall and the cut destroyed it |
| D084 | `A$C9e4b0bea` (828404C9) | W0479 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.941 m, gap 0.021 m; its own earlier opening: lies inside the drawn opening (would be eaten by the cut) | earlier host was wrong: the earlier opening covered the whole wall and the cut destroyed it |
| D085 | `A$C9e4b0bea` (828404CA) | W0404 (brick_block, handles 8283DD9F, 8283DDA0, 8283DDA1) | not in line with the drawn opening: offset 1.424 m, gap 0.091 m; its own earlier opening: ends at the drawn opening (flank) | earlier host was wrong: it is not in line with the drawn door swing |
| D086 | `A$C9e4b0bea` (828404CB) | W0478 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.941 m, gap 0.021 m; its own earlier opening: lies inside the drawn opening (would be eaten by the cut) | earlier host was wrong: the earlier opening covered the whole wall and the cut destroyed it |
| D087 | `A$C9e4b0bea` (828404CC) | W0478 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.85 m, gap 0.021 m; its own earlier opening: not in line with the drawn opening | earlier host was wrong: it is not in line with the drawn door swing |
| D090 | `A$C9e4b0bea` (828405A1) | W0453 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.941 m, gap 0.021 m; its own earlier opening: lies inside the drawn opening (would be eaten by the cut) | earlier host was wrong: the earlier opening covered the whole wall and the cut destroyed it |
| D091 | `A$C9e4b0bea` (828405A2) | W0458 (panel_partial_height, handles 82840414, 82840414) | not in line with the drawn opening: offset 0.941 m, gap 1.494 m; its own earlier opening: ends at the drawn opening (flank) | earlier host was wrong: it is not in line with the drawn door swing |
| D092 | `A$C9e4b0bea` (828405A3) | W0461 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.941 m, gap 1.494 m; its own earlier opening: ends at the drawn opening (flank) | earlier host was wrong: it is not in line with the drawn door swing |
| D093 | `A$C9e4b0bea` (828405A4) | W0464 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.941 m, gap 1.494 m; its own earlier opening: ends at the drawn opening (flank) | earlier host was wrong: it is not in line with the drawn door swing |
| D095 | `A$C9e4b0bea` (828405C4) | W0457 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.85 m, gap 1.494 m; its own earlier opening: ends at the drawn opening (flank) | earlier host was wrong: it is not in line with the drawn door swing |
| D096 | `A$C9e4b0bea` (828405C5) | W0463 (panel_partial_height, handles 82840412, 82840412, 82840414) | not in line with the drawn opening: offset 0.941 m, gap 1.494 m; its own earlier opening: ends at the drawn opening (flank) | earlier host was wrong: it is not in line with the drawn door swing |

## Doors unhosted before and now

| Door | Block (insert handle) | Layer | Opening from | Width (m) |
|---|---|---|---|---|
| D003 | `Glass Door` (8283648E) | `DR-GLASS` | swing arc | 0.886 |
| D004 | `Glass Door` (82836492) | `DR-GLASS` | swing arc | 0.931 |
| D011 | `Glass Door` (828364DA) | `DR-GLASS` | swing arc | 0.931 |
| D015 | `D-750` (82836C64) | `DOOR` | swing arc | 0.599 |
| D017 | `Glass Door` (82836F06) | `DR-GLASS` | swing arc | 0.931 |
| D019 | `D-750` (82836F3B) | `DOOR` | swing arc | 0.6 |
| D020 | `D-750` (82836F3F) | `DOOR` | swing arc | 0.6 |
| D021 | `D-750` (82836F41) | `DOOR` | swing arc | 0.6 |
| D022 | `D-750` (82836F8D) | `DOOR` | swing arc | 0.599 |
| D023 | `D-750` (82836F8F) | `DOOR` | swing arc | 0.599 |
| D044 | `DOOR_SNGL` (8283DBC7) | `WS-DOOR-GLAZ` | swing arc | 0.9 |
| D066 | `DOOR_SNGL` (8283EB37) | `WS-DOOR-GLAZ` | swing arc | 0.9 |
| D067 | `DOOR_SNGL` (8283EB49) | `WS-DOOR-GLAZ` | swing arc | 0.9 |
| D069 | `DOOR_SNGL` (8283F089) | `WS-DOOR-GLAZ` | swing arc | 0.906 |
| D070 | `DOOR_SNGL` (8283F0A4) | `WS-DOOR-GLAZ` | swing arc | 0.936 |
| D071 | `DOOR_SNGL` (8283F0B7) | `WS-DOOR-GLAZ` | swing arc | 0.949 |
| D072 | `DOOR_SNGL` (8283F0CA) | `WS-DOOR-GLAZ` | swing arc | 0.913 |
| D089 | `A$C03859404` (828404E2) | `WS-DOOR` | swing arc | 0.631 |
