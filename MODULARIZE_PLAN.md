# Modularising Atlas

Goal: the team creates a new Atlas themselves. They fill in a workbook, upload
it, and the Atlas is live. No code, no deploy, no waiting on one person.

## What the repo looks like today

Five studies (`/chennai/`, `/noida/`, `/indore/`, `/whitefield/`, `/andheri/`)
and six client views under `/clients/`. Each study is a hand-written trio:
`index.html`, `app.js`, `data.js`. Chennai's `app.js` alone is 130 KB.

The CMS at `/admin/` is already substantial: sign-in with roles, the link
registry, draft and publish with version history and rollback, analytics,
the broker inbox, draft preview. It is genuinely good.

But it can only **edit an Atlas that already exists as committed code**. There
is no way to **create** one. That is the whole gap.

## The finding that makes this cheap

`chennai/app.js` reads exactly nine globals and nothing else:

```
CHN_META  CHN_EXISTING  CHN_OPTIONS  CHN_ZONES  CHN_TRANSIT
CHN_BUS   CHN_PLACES    CHN_FACTS    CHN_MAP_STYLE
```

Everything else it touches is `MAPBOX_TOKEN`, `mapboxgl` and `AtlasCMS`. As
far as **data** goes, the study is a pure function of those nine objects, and
that part is already modular.

### What that first reading missed

Grepping for the city name finds about twenty strings and makes this look like
a rename. It is not. Reading the render path turns up three more kinds of
coupling, and they are the real work:

- **Prose woven into markup.** 142 of the app's template literals put sentences
  inside HTML. Only 22 string literals are plain prose that could simply be
  swapped out. Section headings, the twelve map-layer hints and the fact-group
  titles all describe this study specifically.
- **A scoring model, not a layout.** The priority chooser weights seven
  measures through seven presets, each with its own scoring function. One of
  them is "studio talent nearby", which counts VFX and post houses. That is not
  a Chennai feature, it is a feature for a VFX client in Chennai.
- **Latitude baked in.** `KM_LAT` and `KM_LNG` are constants computed at
  Chennai's latitude. Reused as they are for a Pune or Delhi Atlas they would
  quietly skew every distance on the page.

So the engine does not just hold the study's data. It holds the study's
argument: what to measure, how to weight it, and how to describe it. Making
that data is the job.

### The part that makes it tractable

All seven of Chennai's measures reduce to four kinds:

| Kind | Reads |
| --- | --- |
| `column` | a numeric column on the option |
| `nearestStation` | distance to the nearest station, by status and mode |
| `nearestPlace` | distance to the nearest place of a kind, or of several |
| `fromExisting` | distance from the current office |

That is checked, not assumed. Chennai's seven measures and seven presets are
written out as data in `scripts/lib/study-bundle.js` and validate clean against
Chennai's own bundle. One gap is left: the app discounts a planned station by
how far off its target year is, and no kind expresses that yet.

So the chooser can be declarative. That was the main open risk in this plan and
it is now closed.

Second useful fact: the data already comes from Excel. `CHN_META.sheet` cites
`BFS_Chennai_Ranking_UPDATED_.xlsx`; Andheri cites
`Coworking_Operators_UPDATED_1.xlsx`. Today a person reads those sheets and
hand-writes `data.js`. The workbook to Atlas loop is not a new idea, it is the
existing process with the manual step removed. Nothing in the repo parses a
spreadsheet yet.

## The four pieces

### 1. The schema · done

`engine/SCHEMA.md` defines eleven blocks, of which only `meta` and `options`
are required. The nine data blocks came straight out of what Chennai, Noida,
Indore and Andheri already share. The two that came out of reading the render
path are `copy`, the study's own words, and `measures` with `presets`, the
chooser.

`scripts/lib/validate-bundle.js` checks a bundle and is the same code the
importer will run. `npm test` is 61 cases; `npm run validate` runs all four
committed studies through the schema, which is what keeps the document honest.

Writing it against real data corrected it four times, and each correction is
worth more than the guess it replaced: bus stops ship in two different shapes
and coordinate orders; open or planned is a property of a station, not a line,
because one corridor can be part open; a measure needs a `mode` filter; and
`precision` and transit `mode` have more real values than five and four.

It also found gaps in work already shipped, none of which break a page, which
is why nobody noticed: nine options with no source link for their position,
twelve facts with no source, three micro-market filters that can never match
an option, one study naming no source workbook.

### 2. The engine

Promote Chennai to `/engine/`:

- globals `CHN_*` become `ATLAS.META`, `ATLAS.OPTIONS` and so on
- the twenty hard-coded strings read from `META` instead (title, brand line,
  gate heading, auth key, media path)
- `index.html` becomes a shell with no city in it

The five existing studies keep working untouched: each gets a short shim that
points its old globals at `ATLAS.*`. Nothing already in front of a client
changes behaviour on day one. Migrating them properly is a later, optional
step, not a prerequisite.

### 3. The workbook

A generated `.xlsx`, one sheet per block, with real headers, dropdowns on the
constrained columns (fit group, precision, micro-market key), and one worked
example row the team can overwrite. These are the "empty boxes". The team never
sees JSON.

Downloaded from `/admin/` so it is always the version the importer expects, not
a file going stale in someone's Downloads folder.

### 4. The importer and the route

In `/admin/`: New Atlas, upload the workbook, get a validation report, preview,
publish.

The validation report is the part that decides whether the team actually becomes
independent. It has to name the sheet, the row and the column, in plain words:
"Options row 7: lat and lng are empty, so this property cannot be placed on the
map." Anything less and every upload comes back to one person anyway.

Bundle is stored in Supabase alongside the existing override documents, so it
inherits draft, publish, version history and rollback for free. Live at
`/a/<slug>/`, and at `<slug>.onelocal.co` once the DNS move below is done.

## On the domain

Your conclusion is right. A per-partner subdomain needs `*.onelocal.co`, a
wildcard needs a wildcard certificate, and Vercel issues one only if it runs
the domain's DNS. Without that it is either a browser warning or adding every
subdomain to Vercel by hand. Move the nameservers and it is zero steps per
partner, permanently.

One thing to do before moving: changing nameservers moves **all** DNS for
`onelocal.co`, not just the web records. Every existing record has to be
recreated in Vercel first, MX in particular. If mail runs on that domain and
the MX records are not copied across, email stops the moment the nameservers
cut over. Worth ten minutes of inventory before the switch.

## Order of work

1. ~~Schema written down, tested against the committed studies~~ **done**
2. Engine extracted: data binding, the copy layer, the declarative chooser,
   latitude derived from the bundle. Five shims so nothing live changes
3. Workbook generator, downloadable from `/admin/`
4. Importer and validation report
5. Dynamic route, then the DNS move and subdomains

Step 2 is now the large one, and larger than it first looked: it is three
separate changes inside a 1,661 line file that is in front of clients, and they
should land as three commits, not one. Steps 3 to 5 are mechanical once the
contract exists, and the contract now does.

### How the shim works, and why it is safe

`atlas-cms.js` applies published overrides by **mutating the data in place**:
`applyProperties` splices and edits the array it is given, and `applyFacts`
replaces groups inside the facts object. It never reassigns the globals.

So a shim that hands the engine *references* to `CHN_OPTIONS` and `CHN_FACTS`
keeps every CMS override working, with no change to `atlas-cms.js` and no
change to any `data.js`. Chennai keeps its 88 KB of hand-curated data exactly
as it is; only `app.js` is replaced by the engine. That is what makes step 2
reversible one study at a time.

## Open questions

- **Payment gateway.** "As a demo or a CMS payment gateway" needs unpacking.
  Gating a partner's Atlas behind a payment, or billing partners for Atlas
  access as a product? Different build.
- **Existing studies.** Shim them and leave them, or migrate all five onto the
  engine properly? Recommendation: shim now, migrate later, never in the same
  change as the extraction.
- **Who publishes.** The CMS already has viewer, editor, admin and owner. Should
  creating a new Atlas need admin, or can an editor do it?
