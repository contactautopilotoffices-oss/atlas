---
name: property-film-studio
description: End-to-end playbook for building a premium real-estate property film and 3D experience from a latitude/longitude and a client brief, the way the Flipkart Andheri film (Privilon, Corporate Avenue, 723 Avenue) was built. It covers the questions to ask first; the site survey (open map data, satellite verification and the logic gate); modelling, UVs, texturing, colour and baked lighting in headless Blender; camera shots rendered on every core; Mapbox route and metro clips; ElevenLabs voice, sound effects and music; the ffmpeg and HyperFrames edit; the three.js explorer; and deployment. Use it whenever someone wants a property, district or shortlist film, a fly-through, a "make it like Andheri" experience, renders of a building from a map pin, or any part of that chain (voice-over, SFX, map routes, explorer, deploy).
---

# Property Film Studio

This turns a pin on a map into a film and a 3D experience. The film flies in
through cloud, lands on the metro, walks to each building and shows the
floors. The experience then hands over to a 3D explorer.

The reference build is Flipkart Andheri East, November 2026:
- `andheri-project/film/`: the film, its audio, maps and edit;
- `scripts/world/`: the site and the Blender build;
- `engine/world.js` and `engine/andheri-experience.*`: the web experience;
- `media/flipkart-andheri/`: the shipped assets.

Read `archviz-quality-bar` before rendering anything. This skill is the
pipeline; that one is the bar.

## Golden rules (each one was paid for)

1. **Ask before building.** Run the intake in `references/01-intake.md`. A
   wrong building, floor or metro distance costs a night of renders.
2. **Data truth.** Every name, floor, area, seat count and distance comes
   from the client's deck or a measured source, kept in one canonical table
   (`OVERNIGHT-BRIEF.md`). When sources disagree, the film says less ("ready
   now") and the founder decides.
3. **Survey before modelling.** Pull the open data, render a satellite
   verification overlay, and make the logic gate pass (no missing surveyed
   building, nothing standing on a road, no overlaps). Fleet House once
   vanished silently, and the gate exists because of it.
4. **Keys only in the environment.** `GOOGLE_MAPS_KEY` and
   `ELEVENLABS_API_KEY` are never written into files, commits, journals or
   logs. Google imagery is for **verification only**: never in a model,
   texture, film or deliverable.
5. **Use every core.**
   - Blender Cycles on Metal GPU, two-pass frame-step renders.
   - ffmpeg filters that are single-threaded (minterpolate) get chunked
     across workers.
   - HyperFrames renders with `--workers`.
   - See `references/06-edit-ffmpeg.md`.
6. **Numbers count up; they never spin.** Digit wheels and blurred
   odometers collide and flicker. Use a plain tabular-numeral count-up that
   is right-aligned with a fixed min-width.
7. **Look at the frames.**
   - Check stills at every stage: exposure, black frames, clipping and
     overlaps.
   - Watch the final film end to end before it ships.
   - If the image viewer is down, say plainly that the film was checked by
     numbers only.
8. **Production only after the founder approves.** Branch pushes give a
   protected preview. Merging to `main` deploys to production.

## The pipeline

| # | Stage | Output | Reference |
| - | ----- | ------ | --------- |
| 0 | Intake: questions, data table, storyline | `BRIEF.md`, canonical figures | `01-intake.md` |
| 1 | Site from lat/lng: data, survey, zoning, verification, logic gate | `scene.json`, `refs/*.json`, overlay PNG (private) | `02-site-from-latlng.md` |
| 2 | Hero models: geometry, UVs, materials, colour | `<property>_hero.blend` | `03-blender-model-texture-light.md` |
| 3 | Lighting and look: sun, sky, HDRI, night, bake | renders, baked GLBs | `03-blender-model-texture-light.md` |
| 4 | Shots: cameras, pins, render queue | `shots/out/<shot>/####.png` | `04-shots-and-maps.md` |
| 5 | Map clips: descent, interchange, walking routes | `maps/out/*.mp4` | `04-shots-and-maps.md` |
| 6 | Audio: voice, SFX, music, mix | `audio/mix.wav`, `cues.json` | `05-audio-elevenlabs.md` |
| 7 | Edit: grade, retime, cards, plans, captions, encode | `film.mp4`, poster | `06-edit-ffmpeg.md` |
| 8 | Experience: gate, film, cards, explorer | `engine/*`, `media/<client>/*` | `07-threejs-experience.md` |
| 9 | Voice agent (next): talk to the property | ElevenLabs agent on the page | `08-voice-agent.md` |
| 10 | Ship: checks, journal, deploy, link | production URL | `07-threejs-experience.md` and `09-pitfalls.md` |

Plan the stages so the long ones overlap. Renders run in the background
(nohup) while audio and maps are built. Make a complete provisional cut
early, with stills standing in for any unfinished shot, then swap real
frames in as they land.

## For a first-timer: the shortest path

1. Ask the intake questions and fill in the canonical table.
2. Write `scripts/world/regions/<site>.json` with the lat/lng, then run
   `fetch.py`, `prep.py --region` and `verify_overlay.py`. Look at the
   overlay together with the founder.
3. Build or reuse a hero model, run `diorama.py ... --render hero`, and
   fix it until it passes the quality bar.
4. Write `shots.json`, render pass 1 (`--frame-step 2`), and build a
   provisional cut.
5. Record the voice with ElevenLabs using the prompt templates in
   `05-audio-elevenlabs.md`, then mix.
6. Edit, check, watch it end to end, then deploy the preview and get the
   founder's yes before production.
7. Write the journal entry (global CLAUDE.md) and give the link.
