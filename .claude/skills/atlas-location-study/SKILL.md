---
name: atlas-location-study
description: Builds an ATLAS office location study, the interactive map microsite Autopilot sends clients to compare shortlisted office buildings (overview ranking, micro-markets, rail and bus connectivity, distances, talent catchment, a priority chooser, a conclusion and compare-all), from the client's ranking sheet to a live, password-protected link. Use this skill whenever someone wants a new atlas, office study, location study, site-selection map, shortlist map or "a Chennai/Whitefield/Indore style page" for a city or client, wants to update an existing study with a new sheet, or wants to put the same ATLAS UI on another website. Also use it for questions about how ATLAS studies are made, what data they need, or how to port them.
---

# ATLAS location study

An ATLAS study is a static microsite: `index.html` + `app.js` (the UI, the same for every study) and `data.js` (everything about this study). One folder, no build step, no server. It runs on the ATLAS site (Vercel, `atlas.autopilotoffices.com/<slug>/`) or on any website that can serve static files.

The template in `assets/template/` is the Chennai study's UI made generic: every city name, client name, operator and kind of peer employer comes from `data.js`. A view, measure, layer chip or column with no data behind it hides itself, so a study with no bus feed or no peer employers still looks finished.

The job is mostly research and checking, not code. The client reads every number on the page as a claim from Autopilot, so each one needs a source, a date and an honest precision. Most of this skill is about getting that right.

## What you need before starting

Ask for what you don't have; don't invent it.

1. **The client's ranking sheet** (.xlsx or .csv): rank, building, micro-market, and usually fit group, pricing and ecosystem scores, road distance and drive time from today's office, and the client-facing reason for each rank.
2. **Who the client is and what they hire**: this sets the talent wording (graduates? artists? engineers?) and whether there is a "peer employers" layer (VFX studios, GCCs, banks).
3. **Today's office** (address), so commute distances mean something.
4. **City and slug**: the slug is the URL path, lower-case with hyphens (`chennai`, `te-whitefield`).
5. **Where it will live**: the ATLAS repo, or another website (read `references/porting.md`).
6. **What must not be shown**: e.g. tentative rents or areas the landlord has not confirmed. When unsure, leave figures off the page; they can be added later.

## The process

Work in a scratch folder for research files. The study itself is `study.json` (the one file you edit) packed into `data.js`.

```
assets/template/  ->  <site>/<slug>/   (copy once)
client sheet      ->  sheet_to_json.py  ->  study.json
research          ->  study.json (pins, zones, transit, places, facts)
GTFS feed         ->  gtfs_bus_stops.py ->  study.json
Esri identify     ->  esri_imagery_dates.py -> study.json
study.json        ->  pack_data.js      ->  <slug>/data.js
data.js           ->  render_backdrop.js -> <slug>/media/
<slug>/           ->  check_study.js    ->  screenshots, pass/fail
```

Scripts are in `scripts/`. Python ones run as `python3 -I script.py`; Node ones that use Playwright run as `NODE_PATH=$(npm root -g) node script.js`.

### 1. Copy the template

```bash
cp -r <skill>/assets/template <site>/<slug>
cp <skill>/assets/sample/study.json <work>/study.json   # optional: start from the sample's shape
```

In the ATLAS repo, change `./config.js` to `../config.js` in `index.html` (the build writes the token at the site root) and, if you want the admin panel, add the `atlas-cms.js` script tag where the comment says. Elsewhere, copy `config.example.js` to `config.js` with a public Mapbox token restricted to that domain.

### 2. Turn the sheet into options

```bash
python3 -I scripts/sheet_to_json.py ranking.xlsx study.json
```

It matches columns by header, finds an unlabelled fit column, turns en and em dashes into hyphens, and keeps every column it doesn't know (rent, CAM, area) under `_sheet`, a builder's note that `pack_data.js` never ships. Re-running it on a revised sheet updates ranks, scores and reasons in place and keeps your pins and research.

Read the printed column mapping. If the client's fit groups are not best / value / conditional, define `meta.fits` (see `references/data-schema.md`).

### 3. Pin every building, honestly

Each option needs `lat`, `lng`, `precision` and `geoSrc`:

- `building`: you have confirmed the pin is on that building's roof (satellite plus a listing, OSM building or the developer's own map). Only these get a satellite crop.
- `street`: right road and block, building not confirmed.
- `locality`: neighbourhood only.

Never mark a guess as `building`. A crop of the wrong roof does more damage than an honest "neighbourhood only". Sources and how to check are in `references/research-sources.md`.

### 4. Research the context

All of it goes in `study.json`; every figure carries `src` and, where it changes, `asOf`. See `references/data-schema.md` for fields and `references/research-sources.md` for where to look.

- **Micro-markets** (`zones`, 3 to 6): a band or ellipse each, a one-line character, rent, vacancy and stock from **one** broker report so they compare like for like (newer figures from another broker go in `alt`), pros, cons, occupiers.
- **Transit**: open lines and stations with real coordinates (GTFS, OSM, the operator), and upcoming lines with a `target` text and `eta` year. Upcoming routes are drawn dashed and labelled indicative; say so in the line `note`. Anchors: `airport` and `central` (the main rail terminus) if you want them in Connectivity.
- **Bus stops**: from the city's GTFS feed, `python3 -I scripts/gtfs_bus_stops.py study.json <gtfs-dir> --credit "..." --src <url>`. Check the printed nearest stops against a map.
- **Places**: institutes (`edu`), residential belts (`res`), peer employers (`studio`, worded by `meta.text.studio`), IT parks (`it`). Each needs a source; the map's info buttons list them for the client.
- **Facts**: market, talent and transit headlines with source, date and confidence.
- **Drive speed**: `meta.speed` from a published congestion index (TomTom) with the road factor stated. Drive times are straight-line estimates and the page says so.

### 5. Wording, branding and sign-in

- `meta.text` sets the words: city, date, what the ranking is called, rail and bus operator names, what peer employers are called, who the talent is. Defaults are plain and work for any city.
- `meta.brand` fills the sign-in page and header (title, subtitle, logo). Colours and fonts are CSS variables at the top of `index.html`. Details in `references/ui-guide.md`.
- Sign-in: `python3 -I scripts/make_password.py <ID>` prints a password and two hashes. Put the gate hash in `meta.gate.hash`. In the ATLAS repo also add the `passHash` to `clients/manifest.js` with `redirect: "/<slug>/"`. Give the ID and password to the user privately, in chat; never commit them, never put them in a PR or commit message. Leave the hash empty for a public page.

### 6. Satellite dates, pack, backdrop

```bash
python3 -I scripts/esri_imagery_dates.py study.json          # capture date per building pin
node scripts/pack_data.js study.json <site>/<slug>/data.js   # validates, then writes
NODE_PATH=$(npm root -g) node scripts/render_backdrop.js <site>/<slug>
```

`pack_data.js` stops on errors (a pin with no zone, a duplicate rank, a plaintext password, no open station) and warns on things that mislead (missing sources, pins 60 km from the centre, em dashes in client text). Fix every error; read every warning. If Esri can't be reached from your network, skip the imagery step: the page asks Esri for dates live.

For a city on the coast, add `meta.backdrop` (`sea` side and a `coast` polyline) so the sea stays dark on the sign-in backdrop.

### 7. Check it like a client would

```bash
NODE_PATH=$(npm root -g) node scripts/check_study.js <site>/<slug> --shots <work>/shots --id <ID> --password <PASSWORD>
```

It signs in through the real gate, opens every tab, option, preset, filter, sort and layer chip, checks deep links and phone width, and fails on any page error. Then look at the screenshots yourself: the overview, one option of each fit group, Talent, Conclusion and the phone view. Read the text as the client would. Does every sentence make sense for this client? Is anything stated more precisely than you know it?

With a real Mapbox token, also open the page in a browser and check that pins sit on the right roofs at street zoom.

### 8. Ship

- **ATLAS repo**: add `"/<slug>"` to the redirects in `vercel.json` (copy the `/chennai` entry), the manifest entry from step 5, commit on the working branch, push, open a draft PR, and give the user the Vercel preview link plus the ID and password. Merge only when they ask.
- **Another website**: read `references/porting.md`. In short: upload the folder, add `config.js` with a domain-restricted public token, keep the Esri and OpenStreetMap credits visible.

### 9. Iterate

Clients come back with screenshots and short notes ("remove tentative rent", "need bus stops", "dim the map"). Most changes are data, not code: edit `study.json`, re-pack, re-check. `references/lessons.md` lists the requests that came up on earlier studies and how each was solved; read it before the first client review, because several of them are better done before the client has to ask.

## Rules that protect the client's trust

- Every figure on the page has a source and a date, or it doesn't go on the page.
- Precision is stated, never inflated: building, street or locality; "indicative" for upcoming metro; "estimated" for straight-line drive times.
- Unconfirmed commercial terms (rent, CAM, area) stay off the page unless the user says the client has confirmed them.
- Where a measure has no data for a building (no peer studios nearby), the page says nothing rather than "0".
- No plaintext passwords anywhere in the repo or the PR. Only hashes.
- The client's name, shortlist and reasons are confidential: never copy them into the skill, a sample, or another client's study.
- No em dashes in anything the client reads. Use commas, colons or full stops.

## Files in this skill

| Path | What it is |
| --- | --- |
| `assets/template/` | The UI: `index.html`, `app.js`, `logo.png`, `config.example.js`, `media/`, and a working sample `data.js` |
| `assets/sample/study.json` | A complete sample study (six public IT parks in Chennai, made-up ranking). Sample sign-in: ID `DEMO`, password `DEMO-2026` |
| `scripts/sheet_to_json.py` | Client sheet to options in `study.json` |
| `scripts/gtfs_bus_stops.py` | GTFS feed to bus stops near every option |
| `scripts/esri_imagery_dates.py` | Satellite capture date for every building pin |
| `scripts/make_password.py` | ID, password and the hashes to store |
| `scripts/pack_data.js` | Validates `study.json` and writes `data.js` |
| `scripts/render_backdrop.js` | The hex-field sign-in backdrop |
| `scripts/check_study.js` | Headless test of every view, with screenshots |
| `references/data-schema.md` | Every field in `study.json`, required or optional, with examples |
| `references/research-sources.md` | Where each kind of data comes from and how to verify it |
| `references/ui-guide.md` | The views, and every way to change the look and wording |
| `references/porting.md` | Putting a study on another website |
| `references/lessons.md` | What clients asked for on earlier studies, and the fixes |

Read `data-schema.md` before editing `study.json` by hand, `research-sources.md` before researching a new city, `porting.md` before deploying outside the ATLAS repo, and `lessons.md` before a client review.
