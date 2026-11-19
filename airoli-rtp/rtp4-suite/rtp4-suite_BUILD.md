# BUILD sheet: RTP 4th floor suite (Altruist)

**Result: FAIL on the automated checks.** Image: `rtp4-suite_BUILD.png`.

| Check | Result | Detail |
|---|---|---|
| Nothing inside a wall, glass or door; nothing floating or sunk (hard rule) | pass | 0 into walls/glass/doors, 0 floating or sunk |
| Furniture not overlapping furniture | pass | 0 pair(s) |
| Walkways >= 1.2 m on every route from the entrance to every door | **FAIL** | 7 stretch(es) under 1.2 m (CAD pinch points, for the designer): 1.05 m at (36.9, 95.7); 1.05 m at (35.6, 95.7); 1.05 m at (32.7, 95.7); 1.15 m at (37.3, 97.9); 1.05 m at (37.4, 102.6); 1.05 m at (37.4, 106.4); 1.05 m at (35.5, 95.7) |
| No two coplanar faces closer than 2 mm (flicker) | **FAIL** | 47 overlapping pairs among 299,213 faces: rtp4-suite_WALL_wall_3 / rtp4-suite_SKIRTING_skirting_5 x2; rtp4-suite_DOOR_DOORSNGLleaf_4 / rtp4-suite_DOOR_DOORSNGLleaf_4 x2; rtp4-suite_DOOR_DOORSNGLleaf_3 / rtp4-suite_DOOR_DOORSNGLleaf_3 x2; rtp4-suite_DOOR_DOORSNGLleaf_5 / rtp4-suite_DOOR_DOORSNGLleaf_5 x2; rtp4-suite_DOOR_DOORSNGLleaf_16 / rtp4-suite_DOOR_DOORSNGLleaf_16 x2 |
| Light: exposure from grey cards; previews not blown or crushed | pass | {"cards": [{"room": "Corridor 3", "at": [31.89, 99.56, 0.8], "card_linear": 0.1061}, {"room": "IT ROOM AND IT STORE ROOM", "at": [32.39, 110.56, 0.8], "card_linear": 0.3173}, {"room": "TRAINING ROOM_05", "at": [40.46, 11 |
| Cameras: every shown room has a ray-checked view | pass | 15 rooms with views, 0 without |
| Export: web model written (GLB, LOD GLB, viewer.json, lightmaps) | pass | camera near 0.1 m; files: 2 |

Stage times (s): placement_check 4, geometry 10, light 15, cameras 101, bake 378, export 2, stills 64

## Notes

- FOR THE DESIGNER - Walkways: 7 stretches of the suite corridor between the training rooms read 1.05-1.15 m on the model (about 1.12-1.22 m as drawn; the model walls are 35 mm thicker per face): 1.05 m at (36.9, 95.7); 1.05 m at (35.6, 95.7); 1.05 m at (32.7, 95.7); 1.15 m at (37.3, 97.9); 1.05 m at (37.4, 102.6); 1.05 m at (37.4, 106.4); 1.05 m at (35.5, 95.7)
- Exits: the suite has no stair of its own; through the common main lobby it reaches only stair S4 (core B). A second exit route is not drawn.
- Nothing intersects a wall, nothing floats, no furniture overlaps.
- Coplanar: 47 same-facing pairs closer than 2 mm remain, all small: DOOR/DOOR 17, SKIRTING/WALL 15, GLASS/SKIRTING 4, GLASS/WALL 3, GLASS/GLASS 2, DOOR/GLASS 2, CEILING/WALL 1, DOOR/WALL 1.
- Archviz pass (founder, 19 Nov): the same carpet, fabric, chairs and backlit logo as rtp6-a; the reception tile zone is built from its exact outline.
- Lightmaps (smear fix): walls 28 mm per texel, columns 18 mm, floors and ceilings 40 mm; 20 px island gap, 16 px margin; 10 atlases of 1024 px, 64 samples, 378 s; 0 overlapping texels.
- Hero stills: 6 in models/rtp4-suite/stills/, each reviewed; the reception entry view (framed by door jambs) was dropped and the 6-seater re-shot.
- Heights 3.05 m clear, soffit 3.35 m, 3.6 m floor to floor (user instruction). Frame rtp_local, north up, FFL 15.0 m.

Clay views: clay_00_rtp4-suite_CAM_06-seater-meeting-room-01-1_entry.png, clay_01_rtp4-suite_CAM_06-seater-meeting-room-01-2_entry.png, clay_02_rtp4-suite_CAM_12-seater-conference-room-01_entry.png, clay_03_rtp4-suite_CAM_interview-cabin-01_entry.png, clay_04_rtp4-suite_CAM_interview-cabin-02_entry.png, clay_05_rtp4-suite_CAM_reception-and-waiting_entry.png, clay_top.png
