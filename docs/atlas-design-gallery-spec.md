# Atlas room inspiration gallery specification

Status: implementation direction from supplied tour video, 23 November 2026. Reference research used web text inspection; the supplied video contact sheet was inspected visually. External pages were not visually inspected. Reuse the existing plain JavaScript viewer and Andheri brand assets; these references specify component behavior, not a React dependency.

## Ranked references

| Rank | Reference | Relevant pattern to adopt |
| --- | --- | --- |
| 1 | [Supplied walkthrough contact sheet](/tmp/atlas-gallery-video.png) | Full-bleed architectural scene, small persistent information panel at left, bottom thumbnail filmstrip, eye-level room views and an overview. This is the primary visual reference. The private temporary contact sheet is analysis evidence, not a deployable asset. |
| 2 | [shadcn Carousel](https://ui.shadcn.com/docs/components/carousel) | Horizontal thumbnail browsing with explicit previous/next controls; selected item remains visible. |
| 3 | [shadcn Sheet](https://ui.shadcn.com/docs/components/sheet) | A compact contextual detail surface that can collapse to a mobile sheet. |
| 4 | [shadcn Tabs](https://ui.shadcn.com/docs/components/tabs) | Option 1 / Option 2 selection keeps one active panel and a clearly visible active state. |
| 5 | [shadcn Scroll Area](https://ui.shadcn.com/docs/components/scroll-area) | Independent scrolling in the filmstrip and room information surface. |
| 6 | [shadcn Dialog](https://ui.shadcn.com/docs/components/dialog) | Focused source-image inspection with a named close action and return focus. |
| 7 | [shadcn Aspect Ratio](https://ui.shadcn.com/docs/components/aspect-ratio) | Stable thumbnail framing avoids layout shifts while images load. |
| 8 | [shadcn Skeleton](https://ui.shadcn.com/docs/components/skeleton) | Loading placeholders keep the final thumbnail and text dimensions. |
| 9 | [shadcn Empty](https://ui.shadcn.com/docs/components/empty) | A useful no-matching-references state offers one clear way to revise filters. |
| 10 | [shadcn Toggle Group](https://ui.shadcn.com/docs/components/toggle-group) | Distinct, accessible view-mode controls for overview and room views. |

## Spatial composition and flow

The measured model stays full viewport. At desktop width, place the room card 20px from the left edge below the existing header, width 300–336px, maximum height bounded above the filmstrip. Keep its top hierarchy property → drawing → room. Reserve the bottom 108–124px for a horizontal reference strip; preserve access to existing view controls above it or consolidate those controls into one compact row. Do not cover the selected room with an opaque full-screen gallery.

Clicking a room or its existing sidebar button selects the same source-linked zone. The card shows the room name, seats/capacity only when explicitly counted for that room, and square footage only when the source provides a defensible measured enclosure or explicit area. Unknown values read “Not measured” / “Not specified”; whole-floor workstation counts must never be substituted for room capacity. Label-only zones remain available without invented polygons or areas.

Next, show Option 1 and Option 2 as named saved design alternatives within that room. Do not manufacture two completed renders or map these names to seating variants. Before results exist, explain the empty alternative and offer reference selection. Each alternative retains its own tier, selected references, borrowed features, comments, revision lineage and decision state.

Below, select an exact supplied offering label, then browse room-compatible authorized references. Current known folder labels are “Premium Economy” and “Premium”; absent offerings are not selectable promises. Each thumbnail includes the source title and a review-status label. Selecting a reference opens details with source page/slide/image ID, extracted text, reviewed facts, interpretations and unknowns, then lets the client choose specific features to borrow. A thumbnail click alone does not mean approval.

Use separate explicit states: explored, shortlisted, client-approved inspiration and designer-validated design. Render submission preserves the selected room, authoritative scene/version and camera. An enhancement awaiting geometry checks is shown as pending review. A rejected output cannot become the active validated design. The main scene must not silently change when a thumbnail is selected.

## Tokens and typography

Adopt existing `--fk-blue`, `--fk-yellow`, `--ap-ink`, `--ap-muted` and `--ap-line` values from `engine/andheri-ui.css`. Keep the existing loaded Geist/Inter stack, falling back to system sans; add no remote font request. Map new gallery classes to scoped `--gallery-*` tokens, inheriting the brand values.

| Role | Light | Dark |
| --- | --- | --- |
| Background behind scene | `#e8ecec` | `#0a0a0b` |
| Solid surface | `#ffffff` | `#171a20` |
| Floating surface | `rgba(255,255,255,.96)` | `rgba(23,26,32,.96)` |
| Border | `#dce3ef` | `#3c4657` |
| Text | `#151a23` | `#f4f4f5` |
| Muted text | `#657084` | `#b2bbc9` |
| Primary | `#2a55e5` | `#85a7ff` |
| Primary text | `#ffffff` | `#101827` |
| Selection accent | `#ffc200` | `#ffc200` |
| Success | `#176649` | `#86d6b3` |
| Review warning | `#805700` | `#f2ca73` |
| Error | `#b42335` | `#ff9ca8` |

Use title 20px/600 with −.02em tracking, section title 15px/600, body 14px/400 at 1.45 line height, caption 12px/500 at 1.35, metadata 11px/500 at .04em tracking. Room statistics use 24px/600 tabular numerals. Never put small yellow text on white. Primary selected controls use blue/white in light mode; yellow is a border or small marker.

Spacing scale: 4, 8, 12, 16, 20, 24, 32px. Card radius 16px; button and thumbnail radius 10px; status badge radius 6px. Card shadow `0 8px 30px rgba(25,52,75,.14)`; thumbnail shadow none. A 1px border and solid text-bearing surfaces provide legibility over arbitrary scene colors. The visual emphasis comes from the architectural scene, restrained chrome and clear type hierarchy.

Suggested class mapping: `.atlas-gallery` owns scoped tokens, `.atlas-gallery-room` the contextual card, `.atlas-gallery-stats` the source-backed metrics, `.atlas-gallery-options` option tabs, `.atlas-gallery-strip` thumbnails, `.atlas-gallery-reference` one item, `.atlas-gallery-status` review badge, `.atlas-gallery-detail` source detail, `.atlas-gallery-actions` explicit actions.

## States and motion

Default reference card is neutral; hover strengthens its border. Focus uses existing 3px `#85a7ff` outline with 3px offset. Selection adds a 2px blue border plus checkmark and `aria-pressed`; do not rely on color. Disabled actions explain the missing prerequisite in nearby text. Loading shows fixed-size skeletons and `aria-busy`; empty states name the active room/tier scope. Errors retain all choices and offer retry. Successful persistence announces “Saved”; failed persistence visibly remains unsaved.

Use 180ms opacity/border transitions and 220ms panel translation with `cubic-bezier(.2,.8,.2,1)`. Do not autoplay images or pan the camera while the user reads reference details. The existing camera movement remains authoritative. Honor `prefers-reduced-motion` by eliminating panel translation and nonessential camera animation. Optional mobile vibration, if used, is a single brief confirmation only after an explicit successful selection; no sound or vibration on hover/loading.

## Responsive and accessibility requirements

Below 900px, collapse room details into a bottom sheet above a 80–96px filmstrip; show room name and the two option controls in its compact header. At 600px and below, use viewport safe-area insets, 12px gutters and at least 44px interactive targets. The scene remains visible with sheet collapsed. Long property/source titles wrap without pushing controls offscreen. Scroll the strip horizontally, never the whole document. Avoid two competing bottom docks.

Use native buttons, labeled selects, a named navigation region for thumbnails and semantic headings. Option tabs need keyboard navigation and an associated panel. Source dialogs trap focus, close on Escape and restore the originating button. Global walk shortcuts must ignore gallery input fields and an open dialog; pressing Escape in a dialog must not also change camera mode. Meaningful thumbnails have source-specific alt text; decorative duplicates use empty alt text. Keep contrast at least 4.5:1 for normal text. Announce save/job changes in a restrained live region.

## Preservation and verification checklist

- Keep perspective/overhead, cutaway, ceiling toggle, lighting, PNG export, room focus, walk navigation, guided tour, variant switching and back navigation operable.
- Preserve property, drawing, plan, source SHA-256, authoritative model geometry, openings and measured shell; reference selection changes client choices, not geometry.
- On room/plan/variant change, cancel obsolete requests and reset contextual filters without leaking another room's choices.
- Scope client authorization, offering tier and room compatibility before similarity ranking; hidden references never reach browser payloads.
- Private project captures and source originals use authorized private storage access. Review promotion into the shared library explicitly.
- Load lazy thumbnails and only the visible reference batch; avoid full-resolution slide originals in the filmstrip. Revoke temporary object URLs.
- Exercise desktop and narrow mobile layouts, keyboard-only flow, long/missing metadata, no sources, denied access, failed save, missing provider, pending/rejected result and reduced motion.
- Visually compare the running viewer with the supplied video: full-bleed scene, compact left card, bottom strip, legible active option and accessible overview/eye-level modes.


## Client correction — direct 2D reference selection

The 2D plan is now the primary entry: a room click opens a visual modal without navigating into 3D. Use a 3-column large-image grid on desktop, one column on phones, original-aspect full-size inspection and an explicit Choose this reference action. Show all permitted source projects and both supplied offerings by default; labels retain the exact source client and offering. Stored choice uses the selected reference's offering, never an “all” tier. Keep feature borrowing, jobs and review controls out of this client surface. Optional notes/history/source details preserve evidence without competing with images. Phone booths show a truthful no-reference state; focus pods are not relabeled as phone booths. The existing 3D tools remain optional.

## Meeting generation addition — 24 November 2026

Reuse the existing 2D modal and current typography/tokens; retain the source-backed reference images. Add a short Configuration section for a selected meeting reference: Palette, Surfaces & textures, Lighting. These are interpretation labels taken from that reference, not a material schedule. Use native checkbox labels, 44px hit targets, wrapping rows, keyboard focus and no animation dependency. Palette is required for the native finish proposal; material and lighting are optional prompt details. Do not expose scene camera or raw internal geometry controls.

Footer adds **Generate · 1 demo credit**. Availability and counts must come from the server ledger. Generation saves a dirty choice before enqueuing the same immutable event; show preparing/queued/running/reconciling/confirmed-failure/saved-output states. A refresh restores the same owned job. Show the generated image separately, with an optional native comparison. Never label a native proof or an image fixture as a completed provider generation. The summary shows the saved output only when it belongs to its current submitted event. Preserve empty, expired-access, offline-worker, missing-provider, no-grant, reserved and used-credit states with plain reasons. No dummy options or unsolicited camera controls.

Research/audit synthesis reused the ten references above and the existing simple 2D correction; the audit agents confirmed source option/view grouping and sharp foreground versus softened slide backgrounds. Single-writer implementation extends existing gallery seams.
