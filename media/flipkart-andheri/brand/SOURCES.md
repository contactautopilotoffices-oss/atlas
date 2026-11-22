# Co-brand assets: sources

Everything here is on a transparent background. No logo sits on a white plaque anywhere in the Andheri experience.

## Files used by the pages

| File | Use | Made from |
| --- | --- | --- |
| `autopilot-white.svg`, `autopilot-white.png` | Autopilot on dark or photographic surfaces (opening, film, explorer) | The approved wordmark `airoli-rtp/brand/autopilot-wordmark-white.png` (same artwork as `autopilot-logo-trimmed.png` and the supplied `airoli-rtp/brand/autopilot-supplied.jpeg`), traced to vector with potrace. The PNG is the original raster at 1760 px wide. |
| `autopilot-dark.svg`, `autopilot-dark.png` | Autopilot on white or light surfaces (CAD, interior, 2D atlas header) | The same trace, filled `#0B0B0C`. |
| `flipkart-logo.svg` | Flipkart on light surfaces: blue wordmark and the yellow shopping bag with the blue f | See below. |
| `flipkart-logo-reverse.svg` | Flipkart on dark surfaces: the same lockup with a white wordmark; the bag keeps its yellow and blue | See below. |
| `flipkart-bag.svg` | The bag mark alone | See below. |

How the Flipkart lockup is built (`build_logos.py`, run from the repository root):

- **Wordmark:** the vector "Flipkart" path from Flipkart's own site header, `official/flipkart-header-2026.svg`, downloaded 2026-11-23 from `https://static-assets-web.flixcart.com/batman-returns/batman-returns/p/images/fkheaderlogo_exploreplus-44005d.svg`. Only the wordmark path is used (fill `#2A55E5`); the "Explore Plus" line is dropped. Unchanged in shape.
- **The f:** traced with potrace from Flipkart's official app icon, `official/flipkart-app-icon-lite.png`, downloaded 2026-11-23 from `https://static-assets-web.flixcart.com/apex-static/images/fk-lite-assets/app-icons/app-icon_512x512.png` (2048 px). Filled with the brand blue `#2A55E5`.
- **The bag:** drawn as SVG to match the Flipkart shopping-bag mark (yellow body, orange inner back panel, side folds, rope handle, the f clipped at the bag's base). Flipkart's static servers did not offer the bag lockup as a standalone file, so this part is a faithful redraw, not a download. Body yellow `#FFC200`, back panel `#F29A1F`.
- **Palette:** Flipkart's production CSS declares `--midnight-blue:#2A55E5` and `--golden-yellow:#FFC200` (recorded 2026-11-21 from `https://www.flipkart.com/`).
- `official/flipkart-logo-lite-favicon.png` (the yellow-disc f icon from flipkart.com's `<link rel="icon">`) is kept only as evidence of the colours.

Decision: on dark surfaces the wordmark is white (Flipkart's own reverse treatment) because the blue wordmark is illegible on the dusk photograph and the 3D view; the yellow bag with the blue f keeps the lockup blue and yellow. The full-colour version is used wherever the background is light.

Logos belong to their owners; their use here identifies the Autopilot presentation prepared for Flipkart.

## Older files (kept for other surfaces and history)

- `flipkart-mark.png`, `flipkart-wordmark.png`: the blue f and black wordmark from the flipkart.com header (2026-11-21). No longer used by the Andheri pages.
- `mapbox-logo.svg`: the unmodified official vector from the Mapbox GL JS 3.10.0 stylesheet. Satellite imagery is requested from Mapbox at runtime with visible Mapbox, OpenStreetMap and Maxar attribution.

## Sound

- `twin-arrival.mp3`: generated with ElevenLabs Sound Effects; prompt and model in `sound.json`. Not used by the new opening.
- `selection-tick.mp3`: the project's existing ElevenLabs interface tick, played when a property is chosen, only while sound is on.

## Optional media for the opening

`experience.json` names the film, its poster, the hero still, the card images and the ambient loop. The page requests only what is listed there, so a missing file never produces a failed request. To add the ambient bed, copy `andheri-project/film/audio/ambient_loop.mp3` to `media/flipkart-andheri/film/ambient_loop.mp3` and set `"ambient": "/media/flipkart-andheri/film/ambient_loop.mp3"`.
