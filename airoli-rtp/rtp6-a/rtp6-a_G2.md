# G2 sheet: RTP 6th floor, Option A (Altruist)

**Result: FAIL on the automated checks.** Image: `rtp6-a_G2.png`.

| Check | Result | Detail |
|---|---|---|
| Nothing inside a wall, glass or door; nothing floating or sunk (hard rule) | pass | 0 into walls/glass/doors, 0 floating or sunk |
| Furniture not overlapping furniture | **FAIL** | 2 pair(s): CafeteriaChair3CafeteriaChair3468Level1_56 / CafeteriaChair3CafeteriaChair3468Level1_52 6 mm; CafeteriaChair3CafeteriaChair3469Level1_56 / CafeteriaChair3CafeteriaChair3469Level1_52 4 mm |
| Walkways >= 1.2 m on every route from the entrance to every door | **FAIL** | 5 stretch(es) under 1.2 m (CAD pinch points, for the designer): 1.05 m at (-43.9, 108.7); 0.85 m at (-38.9, 108.7); 0.85 m at (-42.0, 95.5); 1.15 m at (-8.2, 87.5); 1.05 m at (-42.4, 110.0) |
| No two coplanar faces closer than 2 mm (flicker) | **FAIL** | 212 overlapping pairs among 1,300,689 faces: rtp6-a_GLASS_STRUCTURALGLAZING_67 / rtp6-a_GLASS_STRUCTURALGLAZING_85 x5; rtp6-a_SKIRTING_skirting_2 / rtp6-a_WALL_wall_2 x5; rtp6-a_GLASS_PRGLASS_1 / rtp6-a_GLASS_PRGLASS_5 x4; rtp6-a_GLASS_PRGLASS_2 / rtp6-a_GLASS_PRGLASS_6 x4; rtp6-a_GLASS_PRGLASS_3 / rtp6-a_GLASS_PRGLASS_7 x4 |

Stage times (s): placement_check 23, geometry 60, light 50, cameras 1103, bake 2008, export 15

## Notes

- FOR THE DESIGNER - Walkways: 5 CAD pinch points (0.85-1.15 m), from the drawing; desks and walls kept where drawn; the model walls are 35 mm thicker per face than the drawn lines: 1.05 m at (-43.9, 108.7) in Corridor 11; 0.85 m at (-38.9, 108.7) in Open workstations 2; 0.85 m at (-42.0, 95.5) in Open workstations 2; 1.15 m at (-8.2, 87.5) in Corridor 8; 1.05 m at (-42.4, 110.0) in Corridor 11
- Overlaps: 2 cafeteria chair pairs 4-6 mm into each other (a row drawn at 0.57 m); nothing intersects a wall, nothing floats.
- Coplanar: 212 same-facing pairs closer than 2 mm remain, all small slivers: SKIRTING/WALL 73, DESK/DESK 34, GLASS/GLASS 30, GLASS/SKIRTING 28, CEILING/WALL 20, GLASS/WALL 12, FLOOR/SKIRTING 5, SKIRTING/SKIRTING 3. Faces resting on the floor or above the ceiling (52503) are never seen and not counted.
- The 5 cm toilet-door slit reported earlier was the route finder cutting round a wall end, not the drawing; fixed in the checker. The vestibule reads 1.05 m on the model (1.2 m drawn).
- Logo: the backlit halo plate showed as a white panel; it was stripped from this export (no halo glow tonight). The builder now makes the halo as a hidden emissive copy of the letters for the next bake.
- Heights 3.05 m clear, soffit 3.35 m, 3.6 m floor to floor (user instruction). Frame rtp_local, north up, FFL 22.2 m. Bake 1024 px, 64 samples, 4 cm texels (night settings).

Clay views: clay_00_rtp6-a_CAM_cabin-1_entry.png, clay_01_rtp6-a_CAM_cabin-2_entry.png, clay_02_rtp6-a_CAM_cafeteria-1_entry.png, clay_03_rtp6-a_CAM_cafeteria-2_entry.png, clay_04_rtp6-a_CAM_meeting-room-1_entry.png, clay_05_rtp6-a_CAM_meeting-room-2_entry.png, clay_top.png
