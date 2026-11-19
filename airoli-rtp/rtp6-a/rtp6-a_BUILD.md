# BUILD sheet: RTP 6th floor, Option A (Altruist)

**Result: FAIL on the automated checks.** Image: `rtp6-a_BUILD.png`.

| Check | Result | Detail |
|---|---|---|
| Nothing inside a wall, glass or door; nothing floating or sunk (hard rule) | pass | 0 into walls/glass/doors, 0 floating or sunk |
| Furniture not overlapping furniture | **FAIL** | 2 pair(s): CafeteriaChair3CafeteriaChair3468Level1_56 / CafeteriaChair3CafeteriaChair3468Level1_52 6 mm; CafeteriaChair3CafeteriaChair3469Level1_56 / CafeteriaChair3CafeteriaChair3469Level1_52 4 mm |
| Walkways >= 1.2 m on every route from the entrance to every door | **FAIL** | 5 stretch(es) under 1.2 m (CAD pinch points, for the designer): 1.05 m at (-43.9, 108.7); 0.85 m at (-38.9, 108.7); 0.85 m at (-42.0, 95.5); 1.15 m at (-8.2, 87.5); 1.05 m at (-42.4, 110.0) |
| No two coplanar faces closer than 2 mm (flicker) | **FAIL** | 236 overlapping pairs among 1,301,445 faces: rtp6-a_LOGO_tenantlogo_1 / rtp6-a_LOGO_tenantlogo_1 x24; rtp6-a_GLASS_STRUCTURALGLAZING_67 / rtp6-a_GLASS_STRUCTURALGLAZING_85 x5; rtp6-a_SKIRTING_skirting_2 / rtp6-a_WALL_wall_2 x5; rtp6-a_GLASS_PRGLASS_1 / rtp6-a_GLASS_PRGLASS_5 x4; rtp6-a_GLASS_PRGLASS_2 / rtp6-a_GLASS_PRGLASS_6 x4 |
| Light: exposure from grey cards; previews not blown or crushed | pass | {"cards": [{"room": "Corridor 9", "at": [24.22, 97.04, 0.8], "card_linear": 0.2687}, {"room": "Open workstations 2", "at": [-25.95, 103.89, 0.8], "card_linear": 0.312}, {"room": "Open workstations 4", "at": [32.52, 104.5 |
| Cameras: every shown room has a ray-checked view | pass | 36 rooms with views, 0 without |
| Lightmaps: every atlas uses >= 100 8-bit levels on its lit texels, median lit texel >= code 25 (no posterised darks, no black atlas) | pass | 31 atlases, key p98.0; median lit codes 47-152; levels 228-231 |
| Export: web model written (GLB, LOD GLB, viewer.json, lightmaps) | pass | camera near 0.1 m; files: 2 |

Stage times (s): placement_check 12, geometry 33, light 36, cameras 1103, bake 2192, export 12, stills 315

## Notes

- FOR THE DESIGNER - Walkways: 5 CAD pinch points (0.85-1.15 m), from the drawing; desks and walls kept where drawn; the model walls are 35 mm thicker per face than the drawn lines: 1.05 m at (-43.9, 108.7) in Corridor 11; 0.85 m at (-38.9, 108.7) in Open workstations 2; 0.85 m at (-42.0, 95.5) in Open workstations 2; 1.15 m at (-8.2, 87.5) in Corridor 8; 1.05 m at (-42.4, 110.0) in Corridor 11
- Overlaps: 2 cafeteria chair pairs 4-6 mm into each other (a row drawn at 0.57 m); nothing intersects a wall, nothing floats.
- Coplanar: 212 same-facing pairs closer than 2 mm remain, all small slivers: SKIRTING/WALL 73, DESK/DESK 34, GLASS/GLASS 30, GLASS/SKIRTING 28, CEILING/WALL 20, GLASS/WALL 12, FLOOR/SKIRTING 5, SKIRTING/SKIRTING 3. Faces resting on the floor or above the ceiling (52503) are never seen and not counted.
- The 5 cm toilet-door slit reported earlier was the route finder cutting round a wall end, not the drawing; fixed in the checker. The vestibule reads 1.05 m on the model (1.2 m drawn).
- Archviz pass (founder, 19 Nov): carpet charcoal with light streaks and faint 600 joints; woven fabric on sofas; black mesh chairs on chrome bases; built Altruist logo with a working backlit halo and the white chevron mark; two downlights over the logo wall.
- Floors: the octagonal reception tile zone is built from its exact outline (3 mm proud), with no jagged carpet edge; 15.5 m2 of leftover carpet pockets inside rooms now take the room's finish.
- Heights 3.05 m clear, soffit 3.35 m, 3.6 m floor to floor (user instruction). Frame rtp_local, north up, FFL 22.2 m.
- Second pass (advisor review): Altruist's own wordmark from the traced SVG (2.3 m wide, letter tops 1.9 m), white reception desk with a narrower royal-blue front and warm LED plinth, charcoal logo wall on both floors, bright ceilings (up-facing fill under the ceiling, also baked), wall displays and an olive panel in conference rooms, display and whiteboard in training rooms, beam seating for reception visitor chairs; stills see the real Airoli context and are metered per view.
- Lightmaps: key moved from the 99.5th to the 98th percentile (a few sun-patch texels had pushed floors to median code 25 and visible column faces near black); floors 128 samples; float atlases kept (lm_renormalise.py re-keys without a re-bake). Atlases whose packing overflowed baked black (fixed: re-pack with scaled margins, a bake that comes back black now retries and then stops). lightMapIntensity is pi x key in scene-linear units, matched to the viewer exposure; it is not capped at 10.
- Known: the traced wordmark has a few 1.6-1.9 mm sliver side walls (LOGO/LOGO coplanar pairs, seen only edge on); the re-packed atlases share 0.9-2.4 % of their texels at island edges.

Clay views: clay_00_rtp6-a_CAM_cabin-1_entry.png, clay_01_rtp6-a_CAM_cabin-2_entry.png, clay_02_rtp6-a_CAM_cafeteria-1_entry.png, clay_03_rtp6-a_CAM_cafeteria-2_entry.png, clay_04_rtp6-a_CAM_meeting-room-1_entry.png, clay_05_rtp6-a_CAM_meeting-room-2_entry.png, clay_top.png
