# Reliable Tech Park — current presentation

## Presenter links

- Entry: `/airoli-rtp/experience/`. The opening property showcase leads automatically to the CAD layout before the interior3D zoom. **Skip** opens the same CAD plan immediately.
- Direct CAD: `/airoli-rtp/demo/index.html?floor=rtp6-c`.

The current narrator is **Lily**, a mature female voice. The story focuses on the client and the workplace, with no Thane/Belapur roll-call. Autopilot branding remains prominent.

## Local video files

- `film/renders/Autopilot-Reliable-Tech-Park-CAD-female.mp4`:167seconds,1080p/30fps.
- `film/renders/Autopilot-Atlas-2D-walkthrough-female.mp4`:52.7seconds,1080p/30fps.
- `film/narration-v2/female-preview.mp3`:32-second voice preview.

Start the local preview from `/Users/lohit/Downloads/Atlas` with `python3 -m http.server 8137 --bind 127.0.0.1`, then open the links above on that server. The editable film is in `film/`; generation masters and exports remain local, following repository policy.

## Retained CAD evidence

The editable interior is `interior-semantic/rtp6c_603_604_review.blend`; its source1240 meshes are retained. The web model is4.77MB with682 element IDs. The frozen CAD verifier reports5589 passing checks, zero failures. All97 frames and76 expected headers are present;21 cubicle doors intentionally have none. Thirteen other door dimension reviews remain flagged. Finishes, default heights and surrounding city context remain visualization assumptions.

The current client journey goes directly to2D CAD. Interior assets are retained for future review, without forcing an interior zoom in the presentation. See `film/narration-v2/NOTES.md`, `interior-semantic/NOTES.md`, and `demo/DESIGN.md`.
