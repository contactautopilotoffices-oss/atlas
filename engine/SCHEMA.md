# Atlas bundle schema (v1)

One Atlas is one **bundle**: a single JSON document with nine blocks. The
engine renders any valid bundle. Nothing else about an Atlas is code.

This schema was not invented. It is the shape Chennai, Noida, Indore and
Andheri already share, written down. `scripts/validate-bundle.js` checks a
bundle against it and is the same code the workbook importer runs, so what
passes in `/admin/` is exactly what the engine can draw.

## Rules that hold everywhere

- **Coordinates** are `lat` and `lng` as numbers, in degrees. `center` is the
  one exception and is `[lng, lat]`, because that is the order Mapbox takes.
- **Missing is allowed.** Every optional field, and every block except `meta`
  and `options`, may be absent. The engine hides the section it feeds. A thin
  bundle makes a smaller Atlas, never a broken one.
- **Every claim can carry its source.** `src` is a URL shown as a link next to
  the value. This is why the studies are trusted; keep it.
- **`precision`** says how exact a position is, most exact first: `building`,
  `poi`, `complex`, `landuse`, `street`, `locality`, `sector`, `approx`. The
  engine labels the pin with it, so a rough position is honest rather than
  wrong. An unknown value is shown as given and warned about, never refused.
- **`conf`** says how firm a fact is: `high`, `medium` or `low`.
- **Text is text.** No HTML. The CMS already replaces `<` and `>` on anything
  published; the importer does the same on anything uploaded.

## 1. `meta` (required)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | yes | "Chennai Office Study". Page title and brand line. |
| `asOf` | string | yes | `YYYY-MM-DD` or `YYYY-MM`. |
| `center` | `[number, number]` | yes | `[lng, lat]`. Opening view. |
| `zoom` | number | yes | Opening zoom, roughly 10 to 15. |
| `sub` | string | no | One line under the title. |
| `asOfText` | string | no | "October 2026", when the date needs words. |
| `sheet` | string | no | Which workbook the numbers came from. Shown as provenance. |
| `speed` | object | no | `{kmh, factor, note, src}` for drive times, or `{walkMPerMin}` for walking. |
| `nextSteps` | string[] | no | What the client should do next. Rendered as a list. |
| `imagery` | object | no | `{name, detail, checked, credit, src}` for the satellite credit. |
| `columns` | object | no | Display rules for the extra option columns. See block 3. |
| `brand` | object | no | `{title, sub}` to override the header. Defaults to `title` and `sub`. |

## 2. `existing` (optional)

The incumbent: today's office, or the site the study is anchored on. Omit it
and the engine drops every "distance from today's office" measure rather than
showing zeroes.

Required when present: `id`, `name`, `lat`, `lng`.
Optional: `label`, `locality`, `micro`, `precision`, `geoSrc`, `geoNote`,
`src`, `note`, `img`, `occupant`.

## 3. `options` (required, at least one row)

The properties being compared. One row per option.

**Core, required:** `id` (slug, unique), `name`, `lat`, `lng`.

**Core, optional:** `n` (rank or display order), `micro` (a `zones[].key`),
`address`, `locality`, `precision`, `geoSrc`, `geoNote`, `fit` (a fit group
key), `reason` (why it scores as it does), `facts` (see below), `img`,
`photo`, `thumb`, `flag`.

**Extra columns.** Everything else is kept and shown on the property card.
This is deliberate: Chennai scores on `pricingScore` and `ecoScore`, Noida on
`rent` and `cam`, Indore on `carpetArea` and `efficiency`, Andheri on
`perSeat`. Forcing one set of columns would lose what makes each study useful.

Declare each extra column in `meta.columns` so it reads well:

```json
"columns": {
  "perSeat": { "label": "Price per seat", "unit": "INR / seat / month",
               "type": "number", "sortable": true, "higherIsBetter": false },
  "condition": { "label": "Condition", "type": "text" }
}
```

An undeclared extra column still shows, labelled from its key
(`floorPlate` becomes "Floor plate"). Declaring it only makes it better.

**`facts`** on a row is `[{k, v, src}]`: the labelled facts on the property
card, each with its own source.

## 4. `zones` (optional)

Micro-markets. `options[].micro` points at `zones[].key`.

Required when present: `key`, `label`, `name`.
Optional: `sub`, `color`, `shape` (GeoJSON geometry), `character`, `rent`,
`vacancy`, `stock`, `plates`, `count`, `pros` (string[]), `cons` (string[]),
`occupiers`, `sources`.

With no `shape` the zone is a filter and a label, with no polygon drawn.

## 5. `transit` (optional)

```
{ asOf, asOfText, src,
  lines:   [{ key, name, short, mode, status, color, note, src, stations:[{name, lat, lng, open, alias}] }],
  anchors: [{ id, name, lat, lng }] }
```

`mode` is `metro`, `mrts`, `suburban`, `rail`, `monorail` or `bus`. `status`
is `open` or `planned`; planned lines draw dashed, which is how Chennai Phase 2
and the Noida aqua extension are shown honestly as indicative.

`anchors` are the named points distances are measured to, such as a central
station or an airport.

## 6. `bus` (optional)

`{ name, src, credit, asOf, stops, path }`

Two shapes, because two ship today and both are right:

- **`stops`**, individual stops, each either `{name, lat, lng, routes}` or the
  compact tuple `[name, lat, lng, routes]`. Chennai uses the tuple for 108
  stops. Note it is **lat then lng**, the order a person reads off a map page.
- **`path`**, a drawn corridor, as `[lng, lat]` pairs in GeoJSON order. Indore
  uses it for the iBus route.

The two orders are a trap, so each is checked against its own rule rather than
guessed at. Get one wrong and the validator says which order that block wants.

## 7. `places` (optional)

Context pins: employers, institutes, homes, hospitals, studios, tech parks.

Required when present: `id`, `kind`, `name`, `lat`, `lng`.
Optional: `sub`, `precision`, `note`, `src`, `size`, `group`, `locality`,
`occupiers`, `confidence`.

`kind` groups pins into a toggleable map layer. The engine builds one layer
per distinct `kind` and labels it from `meta.columns[kind].label` when given.

## 8. `facts` (optional)

Named groups of sourced facts, rendered as the study's narrative sections.

```json
"facts": {
  "market": [{ "k": "Grade A rent", "v": "INR 95 per sq ft",
               "asOf": "2026-09", "conf": "high", "src": "https://..." }],
  "talent": [ ... ]
}
```

Group keys are free. Order is the order given. `note` is an optional extra
line under a fact. `confidence` is accepted as a synonym for `conf`, because
Whitefield already writes it that way.

## 9. `mapStyle` (optional)

A Mapbox style URL or a style object. Defaults to the engine's own style.

## What a minimum bundle looks like

```json
{
  "meta": { "title": "Pune Office Study", "asOf": "2026-10",
            "center": [73.8567, 18.5204], "zoom": 11.5 },
  "options": [
    { "id": "amar-tech", "name": "Amar Tech Park",
      "lat": 18.5074, "lng": 73.9280, "precision": "building" }
  ]
}
```

That is a working Atlas: a map, one property, a card. Every further block adds
a section.

## Checking a bundle

```
node scripts/validate-bundle.js path/to/bundle.json
node scripts/validate-bundle.js --study chennai
node scripts/validate-bundle.js --all
node scripts/validate-bundle.test.js
```

`--all` runs every committed study through the schema. That is the test that
keeps this document honest: if a change here stops Chennai, Noida, Indore or
Andheri from validating, the change is wrong, not the study.

The messages are written for whoever filled in the workbook. One mistake made
in forty rows is reported as one line naming forty rows, not forty lines,
because a report nobody reads to the end goes back to a developer.

### What it found in the studies already shipped

Run against the four committed studies it reports no errors, and these real
gaps: eight Noida options and one Indore option have no `geoSrc`, so their
positions have no source link; twelve facts across Noida and Indore have no
`src`; Indore's CBD and two of Andheri's six micro-markets contain no options,
so those filters are always empty; Indore names no source workbook. None of
these break a page, which is exactly why they were never noticed.
