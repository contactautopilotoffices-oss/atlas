# 07: The web experience (three.js) and shipping

The flow at `/<client>/world`:

1. the access gate, over a dusk still;
2. **Enter the experience**, which stays disabled until the city has
   loaded;
3. the film;
4. three property cards;
5. the 3D explorer, opened at the chosen building.

**Shortlist** in the explorer brings the cards back.

## The files

| File | What it does |
| ---- | ------------ |
| `engine/world.js` | The explorer: loads the district GLB plus per-property preview GLBs, then walk, dollhouse, labels and the metro walk |
| `engine/andheri-experience.js` and `.css` | The film, the cards, the count-up figures (`.ax-count`), Enter gating (`ready()`) and the ambient loop |
| `engine/andheri-ui.css` | The gate and its background (`film-stills/<prop>-dusk.jpg`) |
| `engine/andheri-scene-lighting.js` | Light controls: time-of-day presets, sun, environment, lightmap swap |
| `engine/andheri-world-layouts.js`, `andheri-navigation.js` | Camera layouts per property and navigation |
| `media/<client>/brand/experience.json` | The data: the hero, the film URL and poster, the cards and their figures, the ambient loop |
| `media/<client>/film/`, `world/film-stills/`, `world/d-preview/*.glb` | The shipped assets |

## Rules

- **Models.** By default, `world.js` loads the d-preview models for the
  client branding. Add `?preview=none` to fall back. Keep the GLBs small:
  - meshopt-compress them (`gltf-transform optimize --compress meshopt`;
    ask before downloading the tool);
  - use `MeshoptDecoder` on the page;
  - **the target is under 25 MB per hero.**

  Corporate Avenue at 80 MB uncompressed made the Enter wait long.
- **Don't let the user enter before parsing has finished.** Model parsing
  during playback was the "stuck" stutter. Gate Enter on loaded and parsed
  models, and show "Preparing the city…".
- **Figures** come from `experience.json`, which is generated from the
  canonical table, never hand-typed. Use the plain count-up, not wheels.
- **Seeking the film needs byte ranges.** The local dev server
  (`scripts/atlas-dev.js`, port 8137) doesn't support them; Vercel does.
  Test seeking on a preview deploy.
- **Sound** starts muted unless the visitor turned it on at the gate. The
  ambient loop on the cards screen stays quiet.
- **Phones:** 44 px targets, the film letterboxed, the cards stacked.

## Shipping

1. Run the checks: the logic gate passes, the film checks pass, there are
   no console errors on `/world`, and the flow (gate, film, cards,
   explorer) has been clicked through locally (preview server
   `atlas-world`).
2. Commit large media with `git add -f` where `.gitignore` excludes them.
   Push commit by commit with `http.postBuffer=524288000` if HTTPS gives
   408 errors.
3. Push the branch to get a Vercel preview, which is protected by SSO.
   Send it to the founder.
4. **Production only after the founder says yes.** Merge `main` in a
   *separate worktree* if other sessions have uncommitted files in the main
   folder. Resolve conflicts in favour of the newer, verified side, and say
   so. Then push `main`.
5. Check that production serves the page, the mp4 (with range support),
   `experience.json`, the GLBs and the stills.
6. Give the link, say what was and wasn't verified, and write the journal
   entry (global CLAUDE.md).
