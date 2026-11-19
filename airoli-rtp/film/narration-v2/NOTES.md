# Female narration and direct CAD presentation — 20 November 2026

The founder requested a mature female voice, a flowing client-focused story, no Thane/Belapur roll-call, and a direct transition to the CAD layout instead of the interior 3D zoom.

## Current delivery

- Voice: ElevenLabs **Lily — Velvety Actress**, the existing mature British female narration voice. No cloning or pitch shifting. No voice was added to the account.
- Model: `eleven_multilingual_v2`; stability0.62, similarity0.75, style0, speaker boost, speed1.06.
- `script.json` is the final text. `film-female-take2.mp3` and `experience-female-take2.mp3` are the full connected takes (local generation masters, not published source).
- Whole scripts were generated in one request each. Natural paragraph boundaries were aligned to the picture with pitch-preserving timing adjustments of0.90×–1.119×. No inserted SSML breaks or sentence-level generation resets.
- The website uses one91-second narration file. At90.5 seconds it fades directly to `../demo/index.html?floor=rtp6-c`, before the interior reveal. Skip, reduced-motion entry and CAD links use the same destination.
- The film opens the CAD plan at85 seconds and ends on CAD views before the Autopilot lockup. Interior zoom footage and the rise into the building were removed from this presentation.

## Evidence

Scribe transcripts of both final female takes confirm Autopilot, CAD, Tata Capital and the spoken seat counts. Neither voice script mentions Thane or Belapur. Source location evidence remains available on demand.

The final mix measures−16.05 LUFS integrated and−2.00 dBTP. Existing music and SFX were remixed under the new voice. Full film:167 seconds; standalone CAD walkthrough:52.7 seconds;1080p/30fps.

`../../experience/review/codex/audio-v2-test.mjs` checks long captions, chapter offset, pause/resume, mute inheritance and the end boundary. Browser checks cover the automatic CAD destination and the floor-opening initialization fix. The film passes the HyperFrames check. Checks verify words, timing, levels and playback; the founder can judge the performance using `female-preview.mp3`.

## Local deliveries

- `female-preview.mp3`:32-second preview of the final female voice.
- `../renders/Autopilot-Reliable-Tech-Park-CAD-female.mp4`:final presentation.
- `../renders/Autopilot-Atlas-2D-walkthrough-female.mp4`:standalone walkthrough.
- `../../experience/audio/continuous-v2/female-voice.mp3`:website narration.

Earlier audio/video drafts remain local for comparison. CAD geometry, finishes and Autopilot branding were retained. Account-library addition was rejected by automatic approval review; the existing Lily voice was used instead.
