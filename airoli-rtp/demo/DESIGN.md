# Atlas 2D presentation polish — implementation specification

Scope: a restrained polish of the existing `airoli-rtp/demo/` UI. Keep the CAD geometry, process colours, data files, floor selection, route, client-requirement/inventory modes, zone selection, zoom/pan and keyboard behavior intact. No framework migration. No property-data invention. Let the drawing remain the hero.

## Grounding and references

Attempted an in-app browser reference tab; tool reported `Browser is not available: iab`. The following references were verified using web search text/metadata (not claimed as visually inspected screenshots). Recommendations below synthesize their documented patterns with the current source audit.

1. **UI Elements — Interactive floor plan, Celena Jasmin** — https://dribbble.com/shots/2484509-UI-Elements-Interactive-floor-plan — closest domain fit; steal warm neutral surrounding chrome that lets a plan carry colour.
2. **Floor Plan Detail Page, Brian Smallwood** — https://dribbble.com/shots/3157524-Floor-Plan-Detail-Page — detail information belongs next to the plan; steal clear plan/detail split and quiet metadata.
3. **Floor Plan Panoramic View, Rafael Picco** — https://dribbble.com/shots/2886881-Floor-Plan-Panoramic-View — explicitly bridges floor specifications and the view from that floor; steal persistent floor context when transitioning between 2D and the experience.
4. **Real Estate Map, Bryce Thompson** — https://dribbble.com/shots/1631000-Real-Estate-Map — map-primary composition and neutral palette; steal a muted world around one active blue.
5. **A Real Estate Map, Innocent Paul Uchechukwu** — https://dribbble.com/shots/26773928-A-Real-Estate-Map — describes clear marker/list interaction states; steal obvious selection feedback shared by geometry and list.
6. **Real Estate Map Design, Anju K Sharma** — https://dribbble.com/shots/14453468-Real-Estate-Map-Design — warm architectural palette; steal tonal surface separation, not extra decoration.
7. **Real Estate Map Page — Wireframe, Alan Gi** — https://dribbble.com/shots/3507907-Real-Estate-Map-Page-Wireframe — left-panel/map anatomy; steal stable edge panels rather than floating information over the plan.
8. **Real Estate Listings, Andrew Simons** — https://dribbble.com/shots/6174561-Real-Estate-Listings — property-map detail modal; steal concise selected-item hierarchy with two prominent values and supporting detail.
9. **Real Estate Dashboard, Sk Tanvir** — https://dribbble.com/shots/26067162-Real-Estate-Dashboard — map plus property statistics; steal compact aligned metric hierarchy, not dashboard-card density.
10. **shadcn/ui Sidebar** — https://ui.shadcn.com/docs/components/base/sidebar — documented header/content/footer anatomy; steal fixed context at top, scrollable rows in middle, quiet provenance footer. No React installation needed.

## Source audit — exact responsibility map

- `airoli-rtp/demo/index.html`: all UI styling lives in inline `<style>`; `:root` token block begins line 18. Main shell `#left`, brand `#brand`, floor cards `.fl`, route `#route`, bottom help `#hint`, loading `#load`, projected `.tag`. 2D shell is `#plan`, drawing `#svgwrap/#svg`, top pill `#ptop`, zoom buttons `#zoom`, right rail `#side`, mode switch `#mode`, selected details `#sel`, list `#list`, provenance footer `#foot`.
- `airoli-rtp/demo/js/plan.js`: `openPlan()` line 46 populates title and geometry; `setMode()` line 98 controls modes; `sidebar()` line 115 makes rows/groups/footer; `select()` line 123 makes detail cards. Leave every SVG path and CAD line width intact in a first polish pass. `fitBox` depends on `#svgwrap` client dimensions: keep right rail width and drawing inset tied to the same CSS variable.
- `airoli-rtp/demo/js/demo.js`: `floorCards()` line 153 makes outside-view floor options; `showFloor()` line 164 opens the plan. Keep current renderer/camera untouched for 2D UI work.
- Data: `plan_rtp6-c.json` title is "6th floor · Offices 603 & 604", zones=22, totals.work_seats=1400 and totals.all_seats=1487. `demo.js:160` currently hardcodes 1350 for the floor card. Do NOT change all numbers to match: it may represent brief seats, whereas totals are CAD. Label the existing brief and CAD concepts separately if surfaced; verify which source supplies 1350 before promoting it as a new metric. `plan_rtp4-suite.json` has zones=18, work_seats=18, all_seats=212; do not assume work_seats is the whole-floor total.

## Design specification

### Direction

Quiet architectural presentation: warm white canvas, ink typography, one confident blue for actions. Three levers: space around the plan, typography with clear information hierarchy, and coherent selected states. Avoid dark conversion, gold accents, excessive glass panels or huge shadows. Existing process colours are semantic and remain unchanged.

### Tokens

Light default: `--bg:#E9E7E2; --paper:#FAFAF7; --surface:#FFFFFF; --surface-soft:#F4F5F3; --ink:#19252C; --sub:#536169; --mute:#69747B; --line:#DFE4E5; --accent:#2563EB; --accent-soft:#EDF3FF; --focus:#1D4ED8; --success:#28785F; --warn:#956125; --danger:#AE4141; --side-width:380px; --shell-gap:20px; --r:16px`.

If a dark theme is already available elsewhere and reused later, use `bg:#111A20`, `paper:#18242C`, `surface:#20303A`, `soft:#263842`, `ink:#F1F5F6`, `sub:#BCC8CE`, `mute:#9CADB6`, `line:#38505C`, `accent:#79A6FF`, `accent-soft:#263E61`, `focus:#A9C6FF`, `success:#79C5A8`, `warn:#E2BC7B`, `danger:#EF9292`. Do not add a new theme switch during tomorrow's small polish.

### Typography

Keep the already-loaded Inter family. All numerals in metric columns use `font-variant-numeric:tabular-nums`. Display/property title 26px/1.1 weight 650 tracking -.035em; plan title `#ptop h2` 17px/1.2 weight 650; rail title 20px/1.2 weight 650; primary metric `#sel .big b` 28px/1.05 weight 650; row labels 13px/1.35 weight 550; body 13px/1.5; labels/caption 11px/1.4 weight 600 tracking .06em. Use fewer weight-800 declarations so hierarchy feels composed, not loud.

### Surfaces and spacing

Use 4/8px rhythm. Outer main shell inset 20px desktop. Panel radii 16px; buttons 10px; small chips 6px. Soft shadow only on floating shell/top/zoom: `0 12px 36px rgba(17,35,47,.10),0 1px 3px rgba(17,35,47,.04)`. Rail has a subtle left rule and no large shadow. `.glass` can use near-opaque white rather than expensive/heavy blur over the 2D plan. Borders express grouping more than cards inside cards.

### Components

- `#left`: stronger property context and quieter supporting copy; balanced Altruist logo with small "Office proposal" context. `.fl`: floor numeral in a pale-blue square, floor/suite at 14px medium, a concise data line, clear Plan action. Minimum height 72px. Keep the existing onclick handlers.
- `#route`: reduce pastel pill dominance; 1px line, 12px radius, transit icon or existing line mark, active state has blue rule/fill. Keep existing sourced time/distance exactly.
- `#ptop`: a solid white top toolbar with clear back action, property/floor context. Avoid covering more drawing area than needed. `#psub` can display "CAD floor plan · select a zone to inspect" without adding facts.
- `#side`: add a compact contextual header if desired (floor title + "Client brief and CAD inventory"). Do not add made-up fit percentages or aggregate counts. A single row-count from current mode is safe if derived live.
- `#mode`: two equal-width 44px targets; active white on pale slate background, blue text/underline or inset border. Use `aria-pressed` matching `.on`.
- `#list .row`: 44–48px minimum row height, aligned swatch/name/seats/area columns. Font 13px. Selected `.cur` gets a pale blue surface and 3px accent inset on its left; shape swatch stays original process colour. Group heading `.grp.k` gets 16px top breathing room.
- `#sel`: 20px padding; selected title can wrap. Two big metrics at top stay tied to existing values; details below use 12–13px text with 8px row padding, right-aligned values and no repeated card boxes. Keep source discrepancy note, but style `.note` as a small amber bordered panel with comfortable line height, not a harsh warning.
- `#foot`: 11–12px with dark enough colour to read on a TV. Keep provenance, no hidden source claims.
- `#zoom`: 44px buttons, focus state, clear +/- and whole-floor icon; retain `#zin/#zout/#zfit` IDs.
- `#hint`: compact neutral glass rail; can shorten to "Drag to rotate · Scroll to zoom · Select a floor" outside view, while a separate plan helper says "Drag to pan · Scroll to zoom · Click a zone". Keep actual existing input behavior.
- Empty/loading states: preserve #load text, style as unobtrusive white status chip with a small spinner; show only while loading. Current data-load failures are not handled by a visible panel; if adding failure handling, give Retry rather than a silent blank stage.

### Motion and access

Transition only background/border/shadow/opacity 140–180ms cubic-bezier(.2,.7,.2,1). No animating width or large blur on the drawing. `:focus-visible` uses 3px soft blue outer ring + 1px dark core. All buttons >=44px. `prefers-reduced-motion:reduce` removes CSS transitions; if changing camera easing, do so in a separate behavioral scope. No gratuitous vibration on a presentation demo; optional short mobile vibration only if tied to a real deliberate selection and feature-detected.

## Think ahead / preservation gates

1. Desktop 1440x900 and 1920x1080: rail stays 380px, drawing retains full remaining area; at 4K avoid tiny absolute text and consider `clamp` only for top-level shell, not SVG geometry.
2. At <=820px preserve existing vertical plan/sidebar split, but guarantee list can scroll and the plan toolbar does not collide with zoom. Sidebar header must not consume most of mobile height.
3. Long process names wrap or truncate with full accessible title; metric columns cannot push names off-screen.
4. Shared active states: zone and row selection must remain synchronized after mode switch or Escape.
5. Keep `#svgwrap` inset equal to `var(--side-width)`; otherwise CAD fit/zoom shifts.
6. Keep all HTML IDs/data attributes used by plan.js and demo.js; adding wrappers must not change selector targets.
7. Focus indicators, contrast, keyboard +/-/arrow/Escape and reduced motion remain functional.
8. No new large fonts, icon library or framework needed; inline minimal icons if necessary.
9. Clear CAD versus brief metrics; do not silently reconcile mismatches.
10. Extract style override to a small `presentation.css` if helpful, but do not scatter repeated magic values across JS.

## Top fixes by value (do these first)

1. Improve #ptop and right-rail hierarchy, coherent typography, 44px controls, clear active rows. This directly affects tomorrow's screen presentation.
2. Align row columns and increase their breathing room; retain exact process labels and colours.
3. Add meaningful rail context/source text and clarify numeric units; keep provenance visible.
4. Bring floor chooser into the same visual language with tidy logo/title/floor cards.
5. Accessibility and responsive finishing pass. Avoid new feature work unless basic delivery requires it.

## Visual acceptance shots and interactions

Capture outside view, floor6 all-process view, selected process with details, inventory mode, floor4 view, and mobile 390x844. Exercise floor card, zone click, sidebar click (autozoom), toggling selected item, mode switch, +/-/fit, drag/pinch, Escape and back-to-building. Confirm original process count, names, geometry and selection metrics remain identical to data. UI polish should be accepted independently from known CAD modeling assumptions.
