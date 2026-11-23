# Morning notes: the Andheri film and experience (23 Nov 2026)

These notes are for the founder's review. Everything is local, on branch `feat/andheri-district-twin`. Nothing has been published.

## Where to look

- **The experience:** http://localhost:8137/flipkart-andheri/world. Add `?intro=1` to see the opening again after the first visit.
  1. Click **Enter the experience**.
  2. The film plays.
  3. When the film ends, the three buildings appear as cards.
  4. Choosing a card opens the 3D explorer at that building. **Shortlist** in the explorer header brings the cards back.
- **The film on its own:** `media/flipkart-andheri/film/andheri-intro.mp4`, 140 s.
- **The edit:** `andheri-project/film/edit/`, a HyperFrames project; open it in the HyperFrames desktop app to change timings or copy. Rebuild with `python3 andheri-project/film/edit/tools/build_root.py`.

## The film, beat by beat (140 s, Alka's voice)

| Time | Picture |
| --- | --- |
| 0–8 s | Title on black: "Andheri East", Marol · Chakala |
| 8–20 s | Satellite descent through cloud onto Andheri East |
| 20–27 s | The Marol Naka interchange: Line 1 and Line 3, all three buildings pinned |
| 27–44 s | **Privilon** at sunrise with its name card, the walk from Marol Naka (140 m, about 2 min), then Privilon at dusk |
| 44–56 s | Privilon's floor plate, drawn three ways: 260, 280 and 301 workstations |
| 56–64 s | **Corporate Avenue**, a drone shot over the campus in afternoon sun, with its name card |
| 64–83 s | The 3rd and 4th floor plans (6,207 sq ft each, 12,414 total), then the walk from Chakala (850 m, about 11 min) |
| 83–100 s | **723 Avenue** rising at dusk with the 13th and 14th floors lit and its name card, then the plans and the terrace |
| 100–105 s | The walk from Marol Naka (700 m, about 9 min) |
| 105–116 s | The closing pull-back over all three, pinned |
| 116–140 s | Autopilot's record (15,000+ seats, 20+ centres, 7 cities), "Pehle vyavahar, phir vyapar", and both logos |

All figures come from the canonical table in `andheri-project/film/OVERNIGHT-BRIEF.md`.

## Decisions taken overnight (please check)

1. **Corporate Avenue's footprint.**
   - The open-map outline of the tower is irregular. The modelled tower, 83 × 41 m after the developer's render, could not stand on it without running into the blocks beside it.
   - It now stands as a 79 × 35 m rectangle along the outline's walls, set 6.6 m towards the main road, with the main facade facing north and the corner block at the west end.
   - To make room, the south end of the campus long block, traced earlier from Google satellite, was cut back by 9 m.
   - **Please confirm on Google satellite** that the tower and the long block stand where the film shows them. Both are recorded in `scripts/world/refs/marol_corridor.json`.
2. **The Corporate Avenue shot was re-planned.**
   - From the first camera, the tower was hidden behind the campus long block, and its main face was in shade.
   - The shot is now a high descent from the west-north-west, with the afternoon sun on the white frames and the corner block.
   - In November the sun never reaches a north-facing facade in Mumbai, so the main face is lit by the sky alone at any hour.
3. **Two shots render in two passes.**
   - The Corporate Avenue drone and the closing pull-back slow to more than a minute a frame as the camera widens.
   - Each renders every other frame first, and the frames in between are interpolated, so a complete film exists early.
   - A second pass then renders the real in-between frames, and the film is rebuilt.
4. **The film runs at 24 frames a second**, the rate of the Blender shots.
5. **One line of narration was re-recorded.**
   - Alka said Chakala is "one stop west" of Marol Naka. On Line 1 it is two stops, with Airport Road in between.
   - The line now says "two stops west", re-recorded in the same voice and settings, and it passed the speech-to-text check.
   - The re-mix moves the three Privilon lines up to 0.7 s earlier. Every other line is where it was.
6. **Music on the cards screen:** a 60-second loop of the film's music bed plays quietly while the cards are on screen. It is silent if sound was turned off at the start.

## Questions only the founder can answer

- **Metro walks.** The film uses the deck's figures. The walking routes measured on the street map differ:

  | Building | Film (deck) | Measured on the map |
  | --- | --- | --- |
  | Privilon | 140 m | 80 m from the foot of the station stairs, 162 m from the platform |
  | Corporate Avenue | 850 m | 908 m from the stairs, 989 m from the platform |
  | 723 Avenue | 700 m | 698 m from the stairs, 780 m from the platform |

  The explorer's own data also disagrees: it lists Corporate Avenue as 920 m from the Western Express Highway station and 723 Avenue as 810 m. The page now shows the deck's figures. The data file should be corrected once you choose.
- **723 Avenue's floors:** some sources say the 12th and 13th, others the 13th and 14th. The film uses the 13th and 14th.
- **Corporate Avenue's condition:** the sources disagree between furnished and warm shell. The film says only "ready now".
- **Alka's last line (l15):** please listen to it once in the film.

## Housekeeping

- To free disk space for the renders, the npm and pip download caches were cleared (about 12 GB). They refill on their own when needed.
- **BlenderKit cars:** BlenderKit has to be installed from Blender's Get Extensions and signed in to your account before its cars can be used. The film has no modelled cars yet.
- **The local server cannot jump within the film.** It does not answer byte-range requests, so the film always plays from the start; Skip still works. Any normal host (Netlify, Vercel) serves ranges, so seeking will work once the page is deployed.
- The Corporate Avenue and 723 Avenue cards now show frames from the new film shots (`media/flipkart-andheri/world/film-stills/`).
- Privilon was resized to the CAD floor plate (22.4 × 67.3 m) before the film shots were rendered.
- **Not seen by eye.** From about 03:45 the app's image viewer stopped responding, for me and for every agent. Everything rendered after that was checked by numbers instead: exposure, black frames, clipping, overlaps and the logic gate. That includes the Corporate Avenue model, the map sequences and the final film. **Please watch the film before it goes to Flipkart.**
