# The UI and how to change it

The UI is one `index.html` (layout and styles) and one `app.js` (everything that happens). Neither names a city or client. Change a study through `data.js` first; touch the code only for a change every future study should get.

## The screen

Three panes on a desktop, a full-screen map with a bottom sheet on a phone.

- **Board (left):** the options as cards (rank, name, locality, distance from today's office, nearest rail and bus), filters (fit groups, "Rail ≤ 1 km"), and an Order menu (ranking, fit to priorities, pricing score, distance from the current office, nearest rail, talent reach; orders without data are dropped).
- **Map (centre):** Mapbox Standard style, faded and with points of interest off so the shortlist stands out. Numbered pins in fit colours; overlapping pins spread apart with leader lines at city zoom. The map bar holds the layer chips, the "All properties" picker and an "i" button per place layer listing every institute, studio or IT park mapped, with sources.
- **Panel (right):** the current view, or an option's page when one is open.

## The views (tabs)

| Tab | What the client gets | Hidden when |
| --- | --- | --- |
| Overview | The ranking in fit groups with the client's reason for each, and "what stands out" tiles (ranked first, best on your priorities, closest to today's office, best rail, and so on) | never |
| Micro-markets | Per zone: character, rent, vacancy, stock with sources, pros, cons, occupiers; city market facts | no zones |
| Connectivity | Per option: nearest open station and how you get there, nearest upcoming metro with its target, nearest bus stop and route count | no transit |
| Distances | Every option against every other and today's office; clusters of options close together | never |
| Talent | Institutes, homes and peer employers within 30 and 45 minutes of each option | no `edu`, `res` or `studio` places |
| Your priorities | A question per measure, Skip to Critical, presets, a live podium; everything re-ranks | never |
| Conclusion | The lead option on these priorities, whether the client's ranking agrees, how presets change the answer, "check first" notes, next steps | never |
| Compare all | Every option, every measure, side by side, with its own priority dials | never |

The CMS (ATLAS repo only) can switch tabs, filters, layers and presets off per study.

An option's page has: the client's reason, verdict chips (what it is strong on), camera buttons (Close-up, Street, Catchment), a satellite crop of the roof (building precision only) with its capture date, key numbers, score bars per measure, talent within drive-time rings, the sheet's row, facts and sources.

## Deep links

Every view has an address, so the team can send a client exactly what they discussed: `#/option/<id>`, `#/distance`, `#/talent`, `#/priorities/<preset>`, `#/priorities/<digits>` (one digit 0 to 4 per measure in play, in order), `#/conclusion/<preset or digits>`. "Copy link" on every view copies it.

## Changing words

All in `data.js` `meta`, no code:
- `meta.text`: city, ranking and sheet names, operator names, what peer employers and talent are called. Full list in `data-schema.md`.
- `meta.brand`: sign-in page title, eyebrow and paragraph, header title and subtitle, logo, browser tab title.
- `meta.fits`: fit group names and colours.
- `meta.presets`: priority presets and their notes.
- `meta.parts`: which measures are scored.
- `meta.nextSteps`: the Conclusion's to-do list.
- "What's in this view" help text per tab is the `GUIDE` object in `app.js`.

## Changing the look

In `index.html`:
- **Colours:** CSS variables at the top of the `<style>` block: `--bg`, `--paper`, `--ink`, `--mut`, `--acc` (accent), `--edu`, `--res`, `--studio`, `--it` (place colours; keep `COL` in `app.js` in step), `--ok`, `--warn`, `--bad`.
- **Fonts:** the Google Fonts `<link>` and `--serif`, `--font`, `--mono`.
- **Logo:** replace `logo.png` with a dark logo on a transparent background, about 320 x 44 px. The sign-in page inverts it to white with a CSS filter (`#gate .logo`), the header darkens it (`#brand .logo`); remove those filters for a colour logo. Or point `meta.brand.logo` at another file.
- **Sign-in backdrop:** `media/hexfield-*.webp`, made by `render_backdrop.js`. Any image works at those names; the CSS hex pattern shows if they are missing.
- **Layout widths:** `--board-w`, `--panel-w`, `--top-h`.

In `app.js`:
- **Map style:** `MAP_STYLE` and `BASEMAP` (Mapbox Standard config: light preset, theme, labels). A page can also set `window.ATLAS_MAP_STYLE` before `app.js` loads to use any Mapbox style URL.
- **Drive-time rings:** `RINGS` (15, 30, 45 minutes) and `DECAY` (how much each ring counts).
- **Priority levels:** `LEVELS` (Skip 0, Low 1, Medium 2, High 3, Critical 5).
- **Measures:** `ALL_PARTS`. Each has a label, the question asked, a plain description of how it is scored, and a `need()` test that hides it when data is missing. Scoring functions are in `scoreParts`.

## What the code does not do

- No server, no build, no framework. It runs from any static host; to try it locally, run `python3 -m http.server` in the folder and open `http://localhost:8000/`.
- No tracking unless `atlas-cms.js` is on the page (ATLAS repo).
- The sign-in is a browser-side check against a SHA-256; `data.js` itself is public to anyone with the URL. For confidential data, serve the folder behind real authentication (see `porting.md`).
- Drive times are straight-line estimates, labelled as such. Routing APIs were left out on purpose: they cost per call, and estimates labelled honestly were enough for a shortlist.
