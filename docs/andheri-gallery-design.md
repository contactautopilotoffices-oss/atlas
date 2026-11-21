# Andheri East property media gallery

Scope: extend the existing detail-panel gallery for the three shortlisted properties. Preserve the current Atlas visual language, navigation, image thumbnails and fullscreen image viewer. This is a video playback extension, with no new UI dependency.

## Evidence and reference synthesis

The existing interface is the primary visual reference. External component documentation was researched via web; no browser screenshots of external references were taken. These references establish component anatomy rather than a replacement theme. Ranked references and the one useful pattern from each:

1. [shadcn Aspect Ratio](https://ui.shadcn.com/docs/components/base/aspect-ratio): reserve the media rectangle before loading; preserve portrait source proportions.
2. [shadcn Card](https://ui.shadcn.com/docs/components/base/card): group player and its caption in one compact media item.
3. [shadcn Carousel](https://ui.shadcn.com/docs/components/base/carousel): keep media items individually bounded and responsive; do not add a carousel library for this small gallery.
4. [shadcn Scroll Area](https://ui.shadcn.com/docs/components/base/scroll-area): media remains within the existing independently scrolling detail panel.
5. [shadcn Typography](https://ui.shadcn.com/docs/components/base/typography): distinguish section label, media caption and supporting information.
6. [shadcn Empty](https://ui.shadcn.com/docs/components/base/empty): omit the gallery entirely when no valid media exists.
7. [shadcn Skeleton](https://ui.shadcn.com/docs/components/base/skeleton): keep stable dimensions during media loading; use a real poster rather than an animated placeholder.
8. [shadcn Dialog](https://ui.shadcn.com/docs/components/base/dialog): preserve the established image lightbox and its dismissal behavior.
9. [shadcn Slider](https://ui.shadcn.com/docs/components/base/slider): retain accessible seeking through browser-native video controls.
10. [shadcn Badge](https://ui.shadcn.com/docs/components/base/badge): retain a small, subdued count beside the media section heading.

## Existing implementation audit

- `engine/app.js:2542`: property detail inserts `galleryHTML(o)` above its satellite image.
- `engine/app.js:2582`: `galleryHTML` accepts image strings and `{src, caption}` objects, filters empty entries, emits a photo count and image grid.
- `engine/app.js:1437`: delegated `.gal img` click opens the image lightbox. Do not broaden this selector to video.
- `engine/index.html:35`: existing theme tokens; no separate dark mode exists.
- `engine/index.html:395`: `.gal` uses responsive 96 px minimum photo thumbnails, 6 px gaps. `.gal img` is 4:3, cropped with `object-fit:cover` and 6 px corners.
- Source videos are approximately 3:4 portrait. Putting a video in the 96 px photo grid makes native controls unusable. Give video items their own full-width row or block.

## Implementation specification

### Theme and typography

Inherit existing tokens: background `--bg:#efe7dc`, paper `--paper:#f7f2ea`, panel `--panel-solid:#faf6f0`, text `--ink:#2a1e16`, secondary `--mut:#6c5b4d`, line `--line:rgba(60,40,25,.13)`, primary `--acc:#a3502c`. Preserve existing states `--ok:#2e7d5b`, `--warn:#b7791f`, `--bad:#b23b2a`. No new dark theme, font download, shadow system or accent color.

Keep existing section `h3`: IBM Plex Mono / monospace, 10.5 px, weight 500, tracking .14em, uppercase, secondary text. Caption: existing system font `--font`, 12 px, line-height 1.4, color `var(--mut)`. Existing display and property titles remain Playfair Display and are unaffected.

### Structure and sizing

Continue accepting existing image strings and objects. Add explicit video objects such as `{type:"video", src:"...mp4", poster:"...jpg", caption:"Privilon · Left wing", width:720, height:960}`. Optional dimensions should reserve each source ratio. Explicit type is preferred; extension inference may support old data but must tolerate query strings.

Use a single media heading such as "Gallery" or separate "Videos" and "Photos" headings, with correct counts. Existing image-only galleries should retain their current "Photos" wording and behavior. Render video before the photos. Each video uses a `figure` with native `video` and visible `figcaption`. Keep its width at 100% of the panel, max-height around 420 px, `object-fit:contain`, and a neutral dark playback background. Preserve the entire floor view rather than cropping it. Use 8–12 px vertical spacing and existing 6–9 px radius vocabulary. At phone widths, the player must shrink with the panel, without horizontal overflow or tiny controls.

### Playback, performance and accessibility

- `controls`, `playsinline`, `muted`, `preload="metadata"`; no autoplay or loop.
- Real JPEG poster per edit; H.264 MP4, yuv420p, faststart, 30 fps and no audio stream.
- Target each final client video at approximately 10–20 MB or less if adequate quality is retained. Never load original MOV files in the client gallery.
- Caption identifies property and wing/view using source labels. Do not invent floor numbers for Corporate Avenue files labeled "floor 1" / "floor 2".
- Escape all source, poster, caption and accessible-label attributes with the existing `esc` helper.
- Native controls provide keyboard playback/seek/fullscreen. Use a descriptive `aria-label`, and visible text fallback with a video link if unsupported.
- Because clips are silent with no narration, no fabricated subtitle track is needed; the visible caption describes their content.
- Keep image zoom behavior confined to images. Native video fullscreen remains browser-owned.
- An unavailable clip should have a visible error/fallback rather than silently leaving an empty region. Invalid entries produce no item.
- No extra UI animation, haptics or sound. Respect the request for silence.

## Downstream checks and acceptance

1. At 390 px and desktop widths, player and caption stay within the panel.
2. Existing colors and readable captions retain contrast; no theme switch is introduced.
3. Poster, loading, playable, failed and absent-media states are understandable.
4. Other atlases with image-only or no galleries render as before.
5. No autoplay competes with map interactions or motion budget.
6. Tab/keyboard access reaches native player controls; captions remain visible.
7. No new audio or haptics; encoded outputs contain zero audio streams.
8. Image lightbox, map, property switching, route selection and access gate still work.
9. Opening one property does not eagerly download all full video bodies; use metadata preload and posters.
10. Shared renderer accepts reusable typed media; only the Andheri East bundle receives the shortlist and new media data.

Verify actual pixels locally and inspect browser network/video metadata before deployment. This document is a design and implementation specification; it does not claim that implementation or visual verification has been completed.
