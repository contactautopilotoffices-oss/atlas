# study.json schema

`study.json` is the one file you edit. `scripts/pack_data.js` checks it and writes `data.js`, which sets these globals for `app.js`:

| study.json key | data.js global | Required |
| --- | --- | --- |
| `meta` | `ATLAS_META` | yes |
| `existing` | `ATLAS_EXISTING` | yes |
| `options` | `ATLAS_OPTIONS` | yes |
| `zones` | `ATLAS_ZONES` | yes, at least one |
| `transit` | `ATLAS_TRANSIT` | yes, at least one open station |
| `bus` | `ATLAS_BUS` | no |
| `places` | `ATLAS_PLACES` | no |
| `facts` | `ATLAS_FACTS` | no |

`assets/sample/study.json` is a complete, working example of every field. Copy shapes from it.

Conventions:
- Positions are `lat` and `lng` in decimal degrees (WGS84). Pairs written as arrays are `[lng, lat]` (Mapbox order): `meta.center`, zone shapes.
- `src` is a full `https://` URL to the page the figure came from. `asOf` is when the figure was true, as the source says it ("Dec 2025", "Q2 2026").
- `conf` is `high`, `medium` or `low`. Low shows a "low" tag next to the figure.
- Keys starting with `_` are notes for the builder (for example `_sheet` from `sheet_to_json.py`). They stay in `study.json` and are stripped from options when packing.
- Text the client reads uses no em dashes. `pack_data.js` warns on them.

## meta

| Field | Req. | Meaning |
| --- | --- | --- |
| `slug` | yes | URL path and storage prefix. `lower-case-with-hyphens`. |
| `title` | | "Chennai Office Study". Used in the page title. |
| `city` | | "Chennai". Used in headings ("Where the next Chennai office should go"). |
| `date` | | Shown in the eyebrow: "Oct 2026". |
| `asOf` | | `YYYY-MM-DD` the facts were last checked. |
| `center` | yes | `[lng, lat]` the map opens on. |
| `zoom` | yes | Opening zoom; 10.5 to 11.5 fits a city. |
| `tz` | | UTC offset for "opens on" dates, default `+05:30`. |
| `sheet` | | One line describing the client's sheet (file name, what it ranks). |
| `speed` | yes | `{ kmh, factor, note, src }`. Average rush-hour speed and road factor for drive-time estimates. Example: `{ "kmh": 16, "factor": 1.3, "note": "TomTom Traffic Index 2025 rush-hour average for Chennai, 1.3x road factor assumed", "src": "https://www.tomtom.com/traffic-index/..." }` |
| `imagery` | | `{ name, detail, checked, captured, credit, src }`, written by `esri_imagery_dates.py`. |
| `gate` | | `{ hash, handoff }`. `hash` from `make_password.py`; empty means no sign-in. `handoff` is the path the site-root login sends people to (`/chennai/`); leave empty elsewhere. Never `id` or `password`. |
| `media` | | Folder for the backdrop images, default `./media/`. In the ATLAS repo the older studies use `../media/<slug>/`. |
| `text` | | Wording. See below. |
| `brand` | | Sign-in page and header text. See below. |
| `fits` | | Fit groups, if not best / value / conditional. See below. |
| `parts` | | Subset of measures to score, e.g. `["price","rail","home","talent"]`. Default: every measure with data. |
| `presets` | | Your own priority presets. See below. |
| `nextSteps` | | List of sentences for the Conclusion's "What to do next". |
| `backdrop` | | `{ sea: "east", coast: [[lat, lng], ...] }` for the sign-in backdrop on a coast. Note: `[lat, lng]` here. |

### meta.text (all optional)

| Key | Default | Chennai example |
| --- | --- | --- |
| `brand` | `Autopilot` | |
| `city`, `date` | from `meta` | |
| `ranking` | `ranking` | `revised ranking` |
| `sheet` | `the sheet` | `the revised sheet` |
| `rail` | `metro or rail` | `metro, MRTS or suburban` |
| `upcoming` | `upcoming metro` | `Chennai Metro Phase 2` |
| `upcomingSource` | `the metro authority's published plans` | `CMRL's plans` |
| `bus` | (empty) | `MTC` |
| `studio` | `Peer studios` | `VFX studios` |
| `studioOne` | `Peer studio` | `VFX / post studio` |
| `studioLong` | `studios and peer employers` | `VFX, animation and post studios` |
| `studioPeople` | `experienced people already working nearby` | `experienced VFX and post artists already working nearby` |
| `studioPart` | `Peer talent nearby` | `Studio talent nearby` |
| `it`, `itNote` | `IT parks`, one line | |
| `talentWho` | `graduates` | `artists and graduates` |
| `prosHead` | `For an office` | `For a studio` |
| `marketNote` | (empty) | A note under the Micro-markets heading on how the figures compare. |

### meta.brand (all optional)

`brandTitle` (header, default the city), `brandSub` (header small caps, default `OFFICE STUDY`), `gateEyebrow`, `gateTitle`, `gateCopy` (the paragraph on the sign-in page), `credit` (the backdrop caption), `logo` (URL of a logo image), `logoAlt`, `pageTitle`, `theme` (browser bar colour).

### meta.fits

```json
"fits": {
  "best":        { "label": "Best fit",         "color": "#2e7d5b", "bg": "rgba(46,125,91,.12)" },
  "value":       { "label": "Value-driven fit", "color": "#b7791f", "bg": "rgba(183,121,31,.13)" },
  "conditional": { "label": "Conditional fit",  "color": "#7b6a5c", "bg": "rgba(123,106,92,.13)" }
}
```
Order matters: the first group is the one counted on the sign-in page ("4 best fit"). Option `fit` values must be these keys. With no fit on any option, the ranking shows as one list with no badges.

### meta.presets

Each preset sets a level per measure: 0 Skip, 1 Low, 2 Medium, 3 High, 4 Critical (Critical weighs 5).
```json
"presets": {
  "balanced": { "label": "Balanced", "note": "Every measure counts the same.", "lv": { "price": 2, "eco": 2, "rail": 2, "home": 2, "talent": 2 } },
  "commute":  { "label": "Commute first", "note": "Rail on foot, then the shortest move.", "lv": { "rail": 4, "home": 3, "price": 1 } }
}
```
Measures missing from `lv` count as Skip. Keep a `balanced` preset; one is made if you leave it out. The measures are `price`, `eco` (sheet scores out of 10), `rail` (open station distance), `home` (distance from today's office), `talent` (institutes and homes by drive time), `studios` (peer employers by drive time), `future` (upcoming metro, discounted by target year).

## existing

Today's office, the point commute distances are measured from.
```json
{ "id": "current", "name": "Client HQ, Tower B", "label": "Current office", "locality": "Guindy", "lat": 13.0087, "lng": 80.2126,
  "precision": "building", "geoSrc": "https://...", "src": "https://...", "note": "Registered office per the annual report." }
```

## options

One per shortlisted building.

| Field | Req. | Meaning |
| --- | --- | --- |
| `id` | yes | `lower-case-with-hyphens`, unique. It is the deep link `#/option/<id>`. |
| `n` | yes | Rank on the client's sheet, 1 upwards, unique. |
| `name` | yes | Display name. |
| `sheetName` | | The name exactly as on the sheet (for matching re-runs). |
| `micro` | yes | A zone `key`. |
| `sheetMicro` | | The locality as the client wrote it. Defaults to the zone label. |
| `address` | | Postal address. |
| `lat`, `lng` | yes | The pin. |
| `precision` | yes | `building`, `street` or `locality`. Only `building` gets a satellite crop. |
| `geoSrc` | | How the pin was checked (OSM way, listing, developer map). Expected for `building`. |
| `fit` | | A `meta.fits` key. |
| `reason` | | The client-facing reason for the rank, in the client's words. |
| `pricingScore`, `ecoScore` | | The sheet's scores, 0 to 10. Without them the price and ecosystem measures drop out. |
| `roadKm`, `driveText` | | The sheet's road distance and drive time from today's office. Without them the page estimates and says "est." |
| `facts` | | `[{ k, v, src }]` rows on the option's page (type, floors, certification, metro note). |
| `flag` | | `{ v, src }` "Check first" note, e.g. a format question to confirm. |
| `img` | | `YYYY-MM-DD` satellite capture date, from `esri_imagery_dates.py`. |

## zones

The micro-markets the shortlist sits in.
```json
{ "key": "omr1", "label": "OMR pre-toll", "name": "OMR pre-toll: Perungudi and Kandanchavadi", "color": "#a3502c",
  "shape": { "type": "band", "from": [80.2512, 12.9722], "to": [80.2458, 12.9528], "w": 0.9 },
  "character": "One sentence on what the area is like for an office.",
  "rent":    { "v": "INR 100-130 per sq ft a month quoted (Savills)", "asOf": "Dec 2025", "src": "https://...", "conf": "medium", "alt": { "v": "Newer: INR 80-125 (Knight Frank, H1 2026)", "src": "https://..." } },
  "vacancy": { "v": "8.0% (Savills)", "asOf": "Dec 2025", "src": "https://...", "conf": "medium" },
  "stock":   { "v": "26.1 msf Grade A", "asOf": "Dec 2025", "src": "https://..." },
  "pros": ["..."], "cons": ["..."],
  "occupiers": { "v": "Amazon, Workday, ...", "src": "https://..." },
  "sources": ["https://...", "https://..."] }
```
Shapes: a `band` is a capsule along a corridor from `from` to `to` (`[lng, lat]`), `w` km either side. An `ellipse` is `{ "type": "ellipse", "c": [lng, lat], "rx": 2.5, "ry": 1.8 }` in km. Outlines are indicative and the page says so.

## transit

```json
{ "asOf": "2026-10-06", "asOfText": "6 Oct 2026",
  "anchors": [ { "id": "airport", "name": "Chennai Airport (T1)", "lat": 12.9838, "lng": 80.1665 }, { "id": "central", "name": "Chennai Central", "lat": 13.0824, "lng": 80.2760 } ],
  "lines": [
    { "key": "blue", "name": "Chennai Metro Blue Line", "short": "Blue Line", "mode": "metro", "color": "#3281C4", "note": "Hours, frequency, where the colour and coordinates came from.", "src": "https://...",
      "stations": [ { "name": "Airport", "lat": 12.98, "lng": 80.16, "open": true } ] },
    { "key": "p2c4", "name": "Phase 2 Corridor 4", "short": "Corridor 4", "mode": "metro", "color": "#E0B800", "note": "Indicative route from published plans.", "src": "https://...",
      "stations": [ { "name": "Porur", "lat": 13.03, "lng": 80.16, "opens": "2026-10-11", "target": "Opens 11 Oct 2026", "eta": 2026 } ] }
  ] }
```
- `mode`: `metro`, `rail`, `suburban`, `mrts` or `tram`. Only unopened `metro` stations count as "metro coming".
- A station is open if `open: true`, or once the date in `opens` has passed (so a study keeps itself current after an opening). `through` is a date after which trains pass but do not stop.
- `target` is the text shown ("Mar 2027, reported"); `eta` is the year used to discount the measure.
- Station order is track order: lines are drawn station to station.

## bus

Written by `gtfs_bus_stops.py`. Stops are `[name, lat, lng, routes]`.
```json
{ "src": "https://github.com/...", "credit": "MTC bus stops: ChennaiGTFS (Apr 2026), ODbL", "asOf": "Apr 2026", "stops": [["Tidel Park", 12.98731, 80.25103, 47]] }
```

## places

```json
{ "id": "ceg-anna-university", "kind": "edu", "name": "College of Engineering, Guindy", "sub": "Guindy",
  "lat": 13.0137, "lng": 80.2365, "precision": "building", "note": "Why it matters to this client.", "size": "Optional size line", "src": "https://..." }
```
`kind`: `edu` (institutes), `res` (residential belts, usually `locality`), `studio` (peer employers, worded by `meta.text.studio`), `it` (IT parks), `hub` (transport hubs). Each kind with at least one place gets a layer chip and an info button that lists them.

## facts

```json
{ "market":  [ { "k": "Leasing YTD 2026", "v": "...", "asOf": "Sep 2026", "conf": "medium", "src": "https://..." } ],
  "talent":  [ ... ],
  "transit": [ ... ] }
```
`market` shows on Micro-markets, `transit` on Connectivity, `talent` on Talent. `note` adds a caveat line.
