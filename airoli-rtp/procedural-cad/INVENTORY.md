# Drawing inventory: 20261118_6TH FLOOR (1).dwg

Everything in the drawing, read by `scripts/flatten.py` (libredwg `dwg2dxf`, then ezdxf) and listed by `scripts/inventory.py`. The full machine-readable list is `inventory.json`; every single entity in the plan window (handle, layer, type, block, position, length) is in `inventory_entities.csv` (48,503 rows).

## Units

- Header: INSUNITS = 4 (mm). Factor used: **0.001 m per drawing unit**.
- Check: block 'D-750' (a 750 mm door) measures 750 drawing units across.
- Check: the plate measures about 125,000 drawing units east-west (125 m).
- Check: dimension values on I-FURN read 600, 900, 1200 units: standard millimetre sizes.
- The brief said INSUNITS 4 means inches (x 0.0254). INSUNITS 4 is millimetres in the DWG/DXF standard, and the geometry confirms it: the factor used is 0.001. (The rtp6-c twin layout also uses millimetres: its origin is 5,822,230.6 mm = 5,822.23 m.)

## What is in the file

- 49,345 entities after exploding blocks (19,199 LINE, 16,865 ARC, 7,838 LWPOLYLINE, 3,360 INSERT, 1,132 ELLIPSE, 482 HATCH, 130 CIRCLE, 97 MTEXT, 90 SPLINE, 65 TEXT, 60 REGION, 26 DIMENSION, 1 SOLID).
- 48,503 of them in the plan window of the 6th floor; Offices 603 & 604 are the clip [23.6, 72.7, 142.5, 118.4] (plan metres).
- 77 layers, 278 block definitions, 162 texts in the window, 26 dimensions, 458 hatch fills in the window, 5,002 exploded hatch lines on layer `wall hatch`.

## Layers that carry building elements

| Layer | Entities in window | In 603/604 | Line length (m) | Types |
|---|---:|---:|---:|---|
| `WS-FURN` | 31,354 | 31,354 | 11,392.0 | ARC 14868, LINE 8639, LWPOLYLINE 6375, INSERT 1471, SPLINE 1 |
| `wall hatch` | 5,002 | 2,681 | 1,135.9 | LINE 5002 |
| `0` | 3,017 | 2,561 | 777.0 | INSERT 861, LWPOLYLINE 685, LINE 585, ARC 507, HATCH 324, CIRCLE 48, ELLIPSE 6, TEXT 1 |
| `FURNITURE m` | 1,846 | 892 | 172.6 | ARC 980, LINE 866 |
| `FIXT` | 1,152 | 448 | 102.0 | ELLIPSE 1116, INSERT 36 |
| `walls` | 874 | 457 | 937.5 | LINE 856, ARC 18 |
| `WS-SANR-FIXT` | 682 | 682 | 153.0 | ARC 303, LINE 200, LWPOLYLINE 74, INSERT 59, CIRCLE 46 |
| `section` | 660 | 491 | 173.3 | LINE 660 |
| `PR-ALU SECTION` | 634 | 208 | 13.7 | LINE 540, SPLINE 72, LWPOLYLINE 12, INSERT 10 |
| `DOOR` | 358 | 203 | 158.0 | LINE 206, LWPOLYLINE 68, INSERT 40, CIRCLE 17, ARC 17, ELLIPSE 10 |
| `duct` | 253 | 122 | 233.9 | LINE 251, ARC 2 |
| `STAIR` | 245 | 137 | 429.2 | LINE 245 |
| `Structural Column` | 234 | 118 | 129.8 | LINE 222, CIRCLE 12 |
| `WINDOW` | 216 | 102 | 171.9 | LINE 216 |
| `I-FURN` | 198 | 196 | 485.7 | LINE 118, LWPOLYLINE 74, HATCH 3, INSERT 2, CIRCLE 1 |
| `OUTER DIM` | 149 | 11 | 1,919.1 | LINE 107, LWPOLYLINE 42 |
| `Column` | 140 | 82 | 621.5 | LWPOLYLINE 122, LINE 17, INSERT 1 |
| `WS-WALL-PHRT` | 136 | 136 | 134.1 | LINE 69, LWPOLYLINE 67 |
| `A.C.P.CLADDING` | 133 | 62 | 548.0 | LINE 112, ARC 21 |
| `STRUCTURAL ASSEMBLY` | 109 | 53 | 671.7 | LINE 69, ARC 38, SPLINE 2 |
| `column-hatch` | 100 | 58 | 510.9 | HATCH 99, SOLID 1 |
| `WS-WALL-PRTN` | 98 | 98 | 1,154.1 | LWPOLYLINE 73, INSERT 22, HATCH 3 |
| `RAILING` | 83 | 45 | 426.6 | LINE 62, ARC 19, SPLINE 2 |
| `STRUCTURAL GLAZING` | 76 | 35 | 994.5 | ARC 53, LINE 16, SPLINE 7 |
| `WS-GLAZ-GLAS` | 76 | 76 | 306.9 | LWPOLYLINE 68, ARC 8 |
| `ELE` | 72 | 35 | 465.4 | LINE 42, ARC 28, SPLINE 2 |
| `W.D.TEXT` | 68 | 40 | 0.5 | TEXT 64, LINE 4 |
| `WS-ANNO-LABL` | 57 | 57 | 0 | MTEXT 57 |
| `WS-DOOR-GLAZ` | 51 | 51 | 33.9 | INSERT 44, LWPOLYLINE 7 |
| `PARTITION` | 49 | 12 | 122.8 | LWPOLYLINE 46, LINE 3 |
| `WS CHAIR` | 40 | 0 | 32.0 | LWPOLYLINE 32, INSERT 8 |
| `TEXT` | 36 | 8 | 0 | MTEXT 36 |
| `HATCH` | 31 | 17 | 55.1 | LINE 27, SPLINE 4 |
| `PR-FULL HT` | 30 | 0 | 194.6 | LWPOLYLINE 27, INSERT 3 |
| `WS-DOOR` | 30 | 30 | 0 | INSERT 30 |
| `PR-HATCH` | 27 | 0 | 194.6 | HATCH 27 |
| `WDDIM` | 26 | 10 | 16.7 | LINE 26 |
| `WS-WALL` | 24 | 24 | 101.0 | LWPOLYLINE 24 |
| `WALL` | 23 | 13 | 19.7 | LWPOLYLINE 19, MTEXT 4 |
| `A.C.P. CLADDING` | 21 | 17 | 42.0 | LINE 20, ARC 1 |
| `SAN-FIX` | 19 | 10 | 0 | INSERT 19 |
| `DR-GLASS` | 17 | 10 | 0 | INSERT 17 |
| `RCC  FINS` | 14 | 8 | 61.7 | LINE 14 |
| `FURN-TOA` | 13 | 0 | 19.2 | CIRCLE 6, LWPOLYLINE 5, INSERT 2 |
| `PR- GLASS` | 8 | 3 | 26.6 | LWPOLYLINE 6, INSERT 2 |
| `CH` | 7 | 7 | 2.7 | LWPOLYLINE 5, ARC 2 |
| `PR-LINE` | 6 | 2 | 28.5 | LWPOLYLINE 6 |
| `Expansion Joint` | 3 | 1 | 0.2 | LINE 3 |
| `FURN` | 2 | 0 | 5.0 | LINE 2 |
| `OUTER DIM2` | 2 | 2 | 435.3 | HATCH 2 |
| `Chairs` | 1 | 1 | 0 | INSERT 1 |
| `Defpoints` | 1 | 1 | 367.3 | LWPOLYLINE 1 |

Layers with nothing in the plan window: `2C50120`, `A-DETL-LLIN`, `AC-Altr Duct`, `AUDIT_I_090519154723-18`, `A_Fixt`, `BREAKOUT`, `CHAIR`, `CTS`, `FURNITURE`, `G-ANNO-TTLB`, `HATCH-WALL`, `I FURN`, `I-FURN-PNLS`, `ID-TEXT`, `LOUNGE AREA SEATING`, `OUTER DIM 1`, `TREES`, `WS-ANNO-DIMS`, `WS-ANNO-TEXT`, `WS-ANNO-TTLB`, `WS-ANNO-VPRT`, `WS-TREE`, `Workstation`, `colno`, `plants`.

## Wall-like line pairs (two parallel lines or two concentric arcs on the same layer)

The spacing between the two lines is the wall thickness as drawn.

| Layer | Pieces | Length (m) | Spacing (mm: count) |
|---|---:|---:|---|
| `STRUCTURAL GLAZING` | 95 | 452.6 | 10: 55, 15: 25, 30: 6, 25: 6, 20: 2, 55: 1 |
| `walls` | 285 | 367.6 | 150: 221, 300: 27, 50: 10, 450: 6, 225: 6, 155: 3, 350: 3, 375: 2 |
| `WS-WALL-PRTN` | 61 | 345.2 | 75: 61 |
| `WS-GLAZ-GLAS` | 56 | 143.9 | 75: 56 |
| `WINDOW` | 133 | 106.9 | 75: 131, 150: 1, 80: 1 |
| `PR-FULL HT` | 27 | 94.6 | 100: 27 |
| `A.C.P.CLADDING` | 33 | 93.1 | 25: 25, 100: 6, 75: 2 |
| `I-FURN` | 21 | 68.5 | 100: 21 |
| `PARTITION` | 45 | 54.6 | 100: 45 |
| `RAILING` | 18 | 49.6 | 75: 18 |
| `WS-WALL` | 36 | 41.8 | 150: 25, 105: 7, 155: 3, 135: 1 |
| `WS-WALL-PHRT` | 29 | 39.7 | 20: 29 |
| `RCC  FINS` | 7 | 30.9 | 150: 7 |
| `PR- GLASS` | 6 | 13.2 | 10: 6 |
| `WALL` | 19 | 9.5 | 20: 19 |
| `A.C.P. CLADDING` | 10 | 4.4 | 25: 8, 100: 2 |

Wall-layer lines with no parallel partner (no thickness can be measured; mostly the chords of single curved lines and furniture on `I-FURN`):

`RAILING` 275 lines / 323.3 m, `A.C.P.CLADDING` 275 lines / 280.9 m, `I-FURN` 161 lines / 236.5 m, `walls` 58 lines / 54.2 m, `STRUCTURAL GLAZING` 36 lines / 37.5 m, `A.C.P. CLADDING` 16 lines / 33.7 m, `PR-LINE` 12 lines / 27.3 m, `PARTITION` 2 lines / 4.5 m

## Hatch

| Layer | Pattern | Inside block | Count |
|---|---|---|---:|
| `0` | SOLID | DOOR_SNGL | 255 |
| `column-hatch` | SOLID | - | 99 |
| `0` | SOLID | A$C9e4b0bea | 66 |
| `PR-HATCH` | SOLID | PARTITION | 27 |
| `I-FURN` | ANSI32 | - | 3 |
| `WS-WALL-PRTN` | SOLID | - | 3 |
| `0` | SOLID | A$C03859404 | 3 |
| `OUTER DIM2` | SOLID | - | 2 |

Plus 5,002 loose lines on `wall hatch`: an exploded masonry hatch between the faces of the base-building walls (used as evidence of masonry).

## Blocks (inserts in the plan window)

| Block | Inserts | In 603/604 | Layer(s) | Plan size (m) | Read as |
|---|---:|---:|---|---|---|
| `A$C62789d74` | 735 | 735 | WS-FURN | 0.91 x 1.11 (370); 1.11 x 0.91 (358); 0.98 x 1.16 (6); 0.97 x 1.15 (1) |  |
| `A$C118a051c` | 54 | 54 | WS-FURN | 1.20 x 0.42 (54) |  |
| `DOOR_SNGL` | 51 | 51 | WS-DOOR, WS-DOOR-GLAZ | 0.92 x 0.89 (19); 0.89 x 0.92 (16); 1.05 x 1.03 (5); 1.22 x 1.19 (4); 1.03 x 1.05 (2) | solid_door |
| `D-750` | 40 | 12 | DOOR | 0.75 x 0.75 (18); 0.75 x 0.74 (6); 0.60 x 0.60 (6); 0.89 x 0.90 (5); 1.19 x 1.20 (4) | solid_door |
| `456` | 36 | 14 | FIXT | 0.51 x 0.41 (19); 0.41 x 0.51 (17) |  |
| `A$C9e4b0bea` | 22 | 22 | WS-WALL-PRTN | 1.37 x 0.97 (19); 0.97 x 1.37 (3) | cubicle_door |
| `A$C5DA27531` | 19 | 10 | SAN-FIX | 0.45 x 0.40 (10); 0.40 x 0.45 (9) |  |
| `A$C779abbf3` | 19 | 19 | WS-FURN | 1.11 x 1.07 (19) |  |
| `Glass Door` | 17 | 10 | DR-GLASS | 0.90 x 0.88 (12); 0.88 x 0.90 (4); 1.18 x 1.20 (1) | glass_door |
| `15PLAV04` | 16 | 16 | WS-SANR-FIXT | 0.45 x 0.51 (12); 0.51 x 0.45 (4) |  |
| `A$Cac28965a` | 15 | 15 | WS-FURN | 1.52 x 2.03 (9); 2.03 x 1.52 (6) |  |
| `A$Ce16c1cc4` | 12 | 12 | 0 | 0.46 x 0.48 (12) |  |
| `A$C6bbc6ebc` | 10 | 10 | WS-SANR-FIXT | 0.36 x 0.67 (10) |  |
| `A$Cd2419d53` | 6 | 6 | WS-FURN | 0.60 x 0.80 (6) |  |
| `A$C7e9a1dde` | 4 | 4 | 0 | 2.16 x 1.50 (2); 1.66 x 2.47 (1); 1.50 x 2.16 (1) |  |
| `PARTITION` | 3 | 0 | PR-FULL HT | 11.83 x 0.10 (1); 5.43 x 0.10 (1); 0.90 x 0.10 (1) |  |
| `CIRCLE 4 SEATER` | 2 | 0 | FURN-TOA | 1.65 x 1.65 (2) |  |
| `GLASS PARTITION` | 2 | 1 | PR- GLASS | 0.10 x 2.94 (1); 0.10 x 0.30 (1) |  |
| `Column` | 1 | 1 | Column | 1.21 x 1.63 (1) |  |
| `double door` | 1 | 1 | I-FURN | 0.94 x 1.80 (1) | solid_door |
| `dsf` | 1 | 1 | I-FURN | 1.18 x 0.90 (1) |  |
| `A$C03859404` | 1 | 1 | WS-DOOR | 0.63 x 0.61 (1) | solid_door |
| `A$Cf78c23c8` | 1 | 1 | WS-SANR-FIXT | 0.36 x 0.59 (1) |  |

## Doors and windows

| Block | Layer | Read as | In 603/604 | Count |
|---|---|---|---|---:|
| `DOOR_SNGL` | `WS-DOOR-GLAZ` | glass_door | yes | 44 |
| `D-750` | `DOOR` | solid_door | no | 28 |
| `A$C9e4b0bea` | `WS-WALL-PRTN` | cubicle_door | yes | 22 |
| `D-750` | `DOOR` | solid_door | yes | 12 |
| `Glass Door` | `DR-GLASS` | glass_door | yes | 10 |
| `Glass Door` | `DR-GLASS` | glass_door | no | 7 |
| `DOOR_SNGL` | `WS-DOOR` | solid_door | yes | 7 |
| `double door` | `I-FURN` | solid_door | yes | 1 |
| `A$C03859404` | `WS-DOOR` | solid_door | yes | 1 |

There are no window blocks: windows are drawn as 75 mm line pairs on layer `WINDOW`. There is no arch mark, arch text or arch block anywhere in the drawing.

## Texts in the plan window

| Handle | Layer | Text | At (m) |
|---|---|---|---|
| 8283354C | `W.D.TEXT` | 6TH  FLOOR  PLAN | 73.0, 60.9 |
| 8283359D | `W.D.TEXT` | F.D. | 39.4, 87.4 |
| 8283359F | `W.D.TEXT` | E.D. | 35.5, 83.7 |
| 8283361C | `W.D.TEXT` | LIFT-WELL | 29.9, 84.1 |
| 8283361D | `W.D.TEXT` | LIFT-WELL | 32.8, 84.1 |
| 8283361E | `W.D.TEXT` | LIFT-WELL | 38.6, 90.0 |
| 8283361F | `W.D.TEXT` | LIFT-WELL | 38.6, 92.8 |
| 82833661 | `W.D.TEXT` | FIRE RESCUE BALCONY | 10.5, 30.0 |
| 8283366F | `W.D.TEXT` | U P | 38.8, 85.5 |
| 82833691 | `W.D.TEXT` | FIRE RESCUE BALCONY | 10.6, 68.6 |
| 82833724 | `W.D.TEXT` | UP | 56.0, 110.3 |
| 8283379E | `W.D.TEXT` | UP | 114.4, 108.3 |
| 828337B1 | `W.D.TEXT` | F.D. | 60.3, 111.7 |
| 82833869 | `W.D.TEXT` | UP | 12.9, 29.9 |
| 828338CA | `W.D.TEXT` | UP | 15.0, 71.2 |
| 82833908 | `W.D.TEXT` | E.D. | 14.4, 73.1 |
| 82833909 | `W.D.TEXT` | F.D. | 13.4, 73.1 |
| 8283391F | `W.D.TEXT` | F.D. | 13.2, 18.0 |
| 82833938 | `W.D.TEXT` | E.D. | 18.2, 14.8 |
| 8283394B | `W.D.TEXT` | F.D. | 130.4, 83.1 |
| 82833958 | `W.D.TEXT` | FIRE RESCUE BALCONY | 55.2, 112.8 |
| 82833959 | `W.D.TEXT` | FIRE RESCUE BALCONY | 112.5, 112.6 |
| 8283396C | `W.D.TEXT` | E.D | 40.7, 46.0 |
| 82833975 | `W.D.TEXT` | E.D | 40.8, 55.4 |
| 8283398C | `W.D.TEXT` | E.D | 80.4, 82.2 |
| 828339A3 | `W.D.TEXT` | E.D | 89.8, 82.3 |
| 828339E5 | `W.D.TEXT` | UP | 18.5, 16.1 |
| 828339EC | `W.D.TEXT` | LIFT-WELL | 33.2, 53.3 |
| 828339F4 | `W.D.TEXT` | LOBBY | 29.4, 50.8 |
| 82833A01 | `W.D.TEXT` | SERVICE DUCT | 26.9, 50.5 |
| 82833A02 | `W.D.TEXT` | SERVICE DUCT | 36.3, 18.2 |
| 82833A05 | `W.D.TEXT` | LIFT-WELL | 20.8, 15.4 |
| 82833A06 | `W.D.TEXT` | LIFT-WELL | 20.8, 13.3 |
| 82833A07 | `W.D.TEXT` | LIFT-WELL | 20.8, 11.2 |
| 82833A1E | `W.D.TEXT` | E.D. | 35.5, 51.7 |
| 82833A4E | `W.D.TEXT` | UP | 37.6, 51.6 |
| 82833A5F | `W.D.TEXT` | LIFT-WELL | 132.4, 91.2 |
| 82833A60 | `W.D.TEXT` | LIFT-WELL | 136.8, 91.3 |
| 82833A78 | `W.D.TEXT` | LIFT-WELL | 134.6, 91.2 |
| 82833A79 | `W.D.TEXT` | UP | 132.5, 88.3 |
| 82833AA2 | `W.D.TEXT` | LIFT-WELL | 87.1, 89.3 |
| 82833AA3 | `W.D.TEXT` | LIFT-WELL | 82.3, 90.1 |
| 82833AAD | `W.D.TEXT` | SERVICE DUCT | 85.0, 96.3 |
| 82833AFA | `W.D.TEXT` | F.D. | 84.0, 87.5 |
| 82833AFB | `W.D.TEXT` | UP | 86.1, 85.5 |
| 82833B09 | `W.D.TEXT` | E.D. | 86.1, 87.5 |
| 82833B1F | `W.D.TEXT` | SERVICE DUCT | 130.6, 104.3 |
| 82833B20 | `W.D.TEXT` | E.D. | 133.7, 87.9 |
| 82833B26 | `W.D.TEXT` | S.D. | 41.1, 47.2 |
| 82833BC1 | `W.D.TEXT` | S.D. | 41.1, 54.2 |
| 82833C5D | `W.D.TEXT` | S.D | 81.6, 82.0 |
| 82833C5E | `W.D.TEXT` | S.D | 88.7, 82.1 |
| 82833C67 | `W.D.TEXT` | E.D. | 109.5, 109.0 |
| 82833C75 | `W.D.TEXT` | E.D. | 60.7, 109.0 |
| 82833C82 | `W.D.TEXT` | F.D. | 13.6, 28.2 |
| 82833CD9 | `W.D.TEXT` | E.D. | 14.6, 28.2 |
| 82833CF2 | `W.D.TEXT` | WORKING  SLAB | 11.3, 74.8 |
| 82833CF3 | `W.D.TEXT` | F.D. | 35.5, 49.6 |
| 82833CFC | `W.D.TEXT` | F.D. | 110.1, 111.6 |
| 82833CFD | `W.D.TEXT` | WORKING  SLAB | 103.7, 112.6 |
| 82834215 | `W.D.TEXT` | LIFT-WELL | 32.9, 48.5 |
| 8283573A | `W.D.TEXT` | LOBBY | 83.7, 93.5 |
| 82835746 | `W.D.TEXT` | OFFICE-603 | 57.6, 76.7 |
| 82835748 | `W.D.TEXT` | OFFICE-604 | 105.1, 76.2 |
| 8283574D | `TEXT` | MEETING ROOM  / 04 PAX | 35.0, 17.3 |
| 82835801 | `TEXT` | MEETING ROOM  / 04 PAX | 38.0, 17.3 |
| 828358CF | `TEXT` | STORE / ROOM | 28.2, 19.9 |
| 828358D0 | `TEXT` | F.H.S | 26.9, 45.8 |
| 828358D1 | `TEXT` | CAFETERIA | 27.9, 43.4 |
| 828358D2 | `TEXT` | KITCHEN | 34.4, 43.2 |
| 828358D3 | `TEXT` | POT WASH AREA | 40.2, 43.1 |
| 828358D4 | `TEXT` | PANTRY | 37.9, 47.5 |
| 828358D5 | `TEXT` | VEG & NON VEG BENMERI COUNTER | 34.6, 42.2 |
| 828358D6 | `TEXT` | COUNTER | 33.4, 44.3 |
| 828358E2 | `TEXT` | STORE / ROOM | 37.6, 53.5 |
| 82835902 | `TEXT` | LADIES / TOILET | 14.3, 37.0 |
| 82835909 | `TEXT` | UPS &  / ELECTRICAL ROOM | 14.7, 42.3 |
| 8283590F | `TEXT` | SPACE /  FOR / OUTDOOR / UNIT | 11.7, 41.8 |
| 8283592B | `TEXT` | LADIES / TOILET | 14.3, 64.3 |
| 82835932 | `TEXT` | SERVER  / ROOM | 14.9, 59.5 |
| 8283593A | `TEXT` | SPACE /  FOR / OUTDOOR / UNIT | 11.7, 59.8 |
| 82835957 | `TEXT` | GENTS / TOILET | 14.5, 77.2 |
| 8283599E | `TEXT` | GENTS / TOILET | 14.8, 26.5 |
| 8283599F | `TEXT` | GENTS / TOILET | 14.9, 23.8 |
| 828359B0 | `TEXT` | LADIES / TOILET | 14.9, 20.6 |
| 828359D1 | `TEXT` | CAFETERIA | 33.9, 40.7 |
| 82835A14 | `TEXT` | STORE / ROOM | 18.1, 12.6 |
| 82835A1B | `WALL` | 1200 MM WIDE PASSAGE | 17.8, 39.7 |
| 82835A1D | `WALL` | FIRE EXIT | 25.4, 86.2 |
| 82835A20 | `TEXT` | F.H.S | 41.5, 32.0 |
| 82835A21 | `TEXT` | F.H.S | 26.9, 32.0 |
| 82835A22 | `TEXT` | REPRO | 26.9, 55.7 |
| 82835A24 | `TEXT` | REPRO | 16.5, 67.4 |
| 82835A25 | `TEXT` | REPRO | 16.7, 30.8 |
| 82835D76 | `TEXT` | ELE & UPS | 78.6, 109.5 |
| 82835D78 | `TEXT` | SERVER ROOM | 73.6, 109.5 |
| 828364BC | `TEXT` | LADIES / TOILET / 163 sft | 101.7, 108.5 |
| 828364D3 | `TEXT` | GENTS / TOILET / 247 sft | 107.5, 108.6 |
| 82836BDD | `WALL` | DRY LANDSCAPE | 109.3, 106.8 |
| 82836C46 | `0` | LOCKER ROOM | 135.2, 88.9 |
| 82836C4E | `TEXT` | LADIES / TOILET | 97.0, 108.1 |
| 82836C5A | `TEXT` | GENTS / TOILET / 247 sft | 92.3, 108.6 |
| 82836C69 | `WALL` | DRY LANDSCAPE | 55.8, 106.8 |
| 82836E72 | `TEXT` | WAITING / AREA | 33.1, 91.4 |
| 82836F0D | `TEXT` | PANTRY | 98.8, 107.9 |
| 82839A6C | `WS-ANNO-LABL` | IDFC_259 | 50.5, 92.8 |
| 82839CD3 | `WS-ANNO-LABL` | HDFC_40 | 85.4, 100.9 |
| 82839FA6 | `WS-ANNO-LABL` | TRU HOME FINANCE_78 | 117.3, 103.9 |
| 8283A4B1 | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 01 | 67.3, 103.4 |
| 8283A4B3 | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 02 | 69.9, 103.4 |
| 8283D119 | `WS-ANNO-LABL` | TATA_216 | 59.8, 100.8 |
| 8283D13A | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 03 | 74.7, 103.4 |
| 8283D28C | `WS-ANNO-LABL` | BPCL_160 | 71.6, 89.6 |
| 8283D28E | `WS-ANNO-LABL` | KRSNAA DIAGNOSTICS / _13 | 78.6, 89.5 |
| 8283D88F | `WS-ANNO-LABL` | HEAPS_50 | 120.1, 91.7 |
| 8283D912 | `WS-ANNO-LABL` | HAMILTON_38 | 123.7, 89.0 |
| 8283DC02 | `WS-ANNO-LABL` | 06 SEATER  / MEETING  / ROOM 01 | 127.3, 108.1 |
| 8283DEAB | `WS-ANNO-LABL` | AKZONOBEL_60 | 46.0, 106.9 |
| 8283DEAD | `WS-ANNO-LABL` | BOB_89 | 33.9, 99.3 |
| 8283DF58 | `WS-ANNO-LABL` | RTP 6TH FLOOR | 27.9, 116.5 |
| 8283DF96 | `WS-ANNO-LABL` | LOCKERS_960 NOS | 29.6, 90.6 |
| 8283DF9A | `WS-ANNO-LABL` | LOCKERS_336 NOS | 29.6, 95.5 |
| 8283DFAC | `WS-ANNO-LABL` | 5'6" PASSAGE  WIDE | 51.2, 105.4 |
| 8283DFAE | `WS-ANNO-LABL` | 5'6" PASSAGE  WIDE | 78.5, 105.4 |
| 8283DFB0 | `WS-ANNO-LABL` | 5'6" PASSAGE  WIDE | 112.2, 105.4 |
| 8283DFB2 | `WS-ANNO-LABL` | 6' PASSAGE  WIDE | 128.5, 96.2 |
| 8283DFB4 | `WS-ANNO-LABL` | 6' PASSAGE  WIDE | 40.6, 98.6 |
| 8283E03D | `WS-ANNO-LABL` | RECEPTION  / MAIN PASSAGE | 34.5, 90.6 |
| 8283E3CE | `WS-ANNO-LABL` | ARKA FINCAP LIMITED_8 | 52.4, 108.9 |
| 8283E3F9 | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 04 | 76.8, 103.4 |
| 8283E3FC | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 05 | 76.8, 100.5 |
| 8283E3FF | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 06 | 76.8, 97.7 |
| 8283E402 | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 07 | 76.8, 94.6 |
| 8283E405 | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 08 | 82.1, 104.3 |
| 8283E425 | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 09 | 82.1, 101.8 |
| 8283E43C | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 10 | 82.1, 99.3 |
| 8283E75F | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 11 | 90.0, 104.3 |
| 8283E776 | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 12 | 90.0, 101.8 |
| 8283E78C | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 13 | 90.0, 99.3 |
| 8283E8AA | `WS-ANNO-LABL` | HINDUJA_41 | 88.7, 87.5 |
| 8283E91A | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 14 | 94.6, 103.4 |
| 8283E91D | `WS-ANNO-LABL` | 04 SEATER  / MEETING  / ROOM 15 | 97.1, 103.4 |
| 8283E920 | `WS-ANNO-LABL` | EDELWEISS_74 | 97.4, 101.3 |
| 8283E9EA | `WS-ANNO-LABL` | ONE ASSIST_56 | 104.6, 104.0 |
| 8283E9EC | `WS-ANNO-LABL` | ROCKET LEARNING_50 | 104.6, 91.6 |
| 8283EAA9 | `WS-ANNO-LABL` | CHOLA MS_69 | 105.0, 84.8 |
| 8283EB00 | `WS-ANNO-LABL` | AIRTEL_41 | 114.8, 84.8 |
| 8283EB2C | `WS-ANNO-LABL` | VI_08 | 127.8, 86.2 |
| 8283EB5A | `WS-ANNO-LABL` | ICICI_03 | 124.5, 107.2 |
| 8283EB5C | `WS-ANNO-LABL` | ADITYA / BIRLA / _03 | 122.7, 107.7 |
| 8283F016 | `WS-ANNO-LABL` | 12 SEATER CONFERENCE ROOM | 133.9, 101.9 |
| 8283F0DC | `WS-ANNO-LABL` | CABIN_04 | 139.5, 96.5 |
| 8283F0DE | `WS-ANNO-LABL` | CABIN_03 | 139.4, 99.1 |
| 8283F0E0 | `WS-ANNO-LABL` | CABIN_02 | 138.4, 100.6 |
| 8283F0E2 | `WS-ANNO-LABL` | CABIN_01 | 137.3, 102.6 |
| 8283F0E6 | `WS-ANNO-LABL` | CORPORATE WS_19 NOS | 134.1, 98.4 |
| 8283F0F9 | `WS-ANNO-LABL` | CORPORATE AREA | 131.0, 100.9 |
| 828403E2 | `WS-ANNO-LABL` | GROWTH  / SEAT_21 | 118.0, 107.8 |
| 82840577 | `WS-ANNO-LABL` | LADIES  / TOILET | 89.1, 109.4 |
| 82840579 | `WS-ANNO-LABL` | GENTS / TOILET | 84.2, 110.6 |
| 828405C1 | `WS-ANNO-LABL` | GENTS / TOILET | 64.2, 107.4 |
| 828405D6 | `WS-ANNO-LABL` | LADIES  / TOILET | 69.9, 109.4 |

No text in the drawing names a wall type, a material, a height or a door head. The texts are room and tenant names, passage widths and core labels.

## Dimensions

| Handle | Layer | Measured (m) |
|---|---|---:|
| 82836F7B | `I-FURN` | 1.06975 |
| 82836F7C | `I-FURN` | 3.73 |
| 82836F7D | `I-FURN` | 1.07701 |
| 82836F7E | `I-FURN` | 0.90005 |
| 82836F7F | `I-FURN` | 2.18526 |
| 82836F82 | `I-FURN` | 1.96464 |
| 82836F83 | `I-FURN` | 1.5003 |
| 82836F84 | `I-FURN` | 1.20113 |
| 82836F85 | `I-FURN` | 0.6 |
| 82836F86 | `I-FURN` | 0.59428 |
| 82836F87 | `I-FURN` | 1.19428 |
| 82836F88 | `I-FURN` | 1.18128 |
| 82836F89 | `I-FURN` | 1.19328 |
| 82836F8A | `I-FURN` | 1.59988 |
| 82836F8B | `I-FURN` | 1.12491 |
| 82836F90 | `I-FURN` | 1.1724 |
| 82836F91 | `I-FURN` | 1.15001 |
| 82836F92 | `I-FURN` | 1.0276 |
| 82836F93 | `I-FURN` | 1.74384 |
| 82836F94 | `I-FURN` | 2.18527 |
| 82836F95 | `I-FURN` | 0.5724 |
| 82836F96 | `I-FURN` | 0.6 |
| 82836F97 | `I-FURN` | 0.60017 |
| 82836F98 | `I-FURN` | 0.54983 |
| 82836F99 | `I-FURN` | 0.60017 |
| 82836F9A | `I-FURN` | 0.57843 |

## Sheet text (paper space)

-; 00; 01; 02; 02/04 MEETING ROOM; 03; 03.10.20; 04; 06; 06/08 MEETING ROOM; 19-07-2022; 429; 450; AREA :-; BOARD ROOM; CABINS; CAFETERIA; CEO CABIN; CLIENT:; DATE :-; DATE :- 03.10.2020; DESCRIPTION; DIRECTION; GENTS WASH ROOM; LADIES WASHROOM; LEGEND; LEVEL 2,3 B, LAXMI TOWER,G-BLOCK, PLOT # C-25, BANDRA KURLA COMPLEX, MUMBAI-400 051.  Phone : 022-66223344. Fax:022-66223333. E-mail : business@toa.org.in WEBSITE: www.toa.org.in; Level 2,3 B, Laxmi Tower,G-Block, Plot # C-25, Bandra Kurla Complex, Mumbai:- 400 051   Phone : 22-66223344/344.  Fax:022-66223333 E-mail :business@toa.org.in Website:www.toa.org; MUMBAI - HYDERABAD - PUNE; N; OPTION :- 01; PROPOSED INTERIOR LAYOUT FOR 6TH FLOOR 601 & 602  RELIABLE TECH PARK,AIROLI.; PROV; R0; RECEPTION AND WAITING AREA; REPRO; REQ; REV NO.; SCALE :-; SERVER ROOM; STORE ROOM; TEAM ONE ARTEQ; TELEPHONE BOOTH; TRAINING ROOM; Team ONE ArteQ; UPS & ELECTRICAL ROOM; WORKSTATION 4' X 2'

