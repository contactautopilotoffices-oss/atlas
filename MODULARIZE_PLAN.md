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

Everything else it touches is `MAPBOX_TOKEN`, `mapboxgl` and `AtlasCMS`. The
study is a pure function of its data. It is already modular in substance; it
just carries a city-specific prefix on the globals and about twenty hard-coded
strings ("Chennai", the gate heading, the storage key, the media path).

So we are not writing a new engine. We are renaming one, and reusing a UI that
is already proven in front of clients.

Second useful fact: the data already comes from Excel. `CHN_META.sheet` cites
`BFS_Chennai_Ranking_UPDATED_.xlsx`; Andheri cites
`Coworking_Operators_UPDATED_1.xlsx`. Today a person reads those sheets and
hand-writes `data.js`. The workbook to Atlas loop is not a new idea, it is the
existing process with the manual step removed. Nothing in the repo parses a
spreadsheet yet.

## The four pieces

### 1. The schema

One contract, the nine blocks above, written down once and versioned. Chennai,
Noida and Indore already follow it closely, which is the proof it is the right
shape. Whitefield (one `WF` object) and Andheri (adds `CENTRES`, `STATIONS`)
are the two that diverge and get mapped onto it.

Each block gets: required fields, optional fields, types, and what the engine
does when a field is missing. Missing data must degrade to a hidden section,
never a broken page, exactly as `atlas-cms.js` already does for overrides.

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

1. Schema written down, with the existing three studies as the test that it fits
2. Engine extracted, five shims in place, every existing study verified unchanged
3. Workbook generator, downloadable from `/admin/`
4. Importer and validation report
5. Dynamic route, then the DNS move and subdomains

One and two are the real work. Three, four and five are mechanical once the
contract exists.

## Open questions

- **Payment gateway.** "As a demo or a CMS payment gateway" needs unpacking.
  Gating a partner's Atlas behind a payment, or billing partners for Atlas
  access as a product? Different build.
- **Existing studies.** Shim them and leave them, or migrate all five onto the
  engine properly? Recommendation: shim now, migrate later, never in the same
  change as the extraction.
- **Who publishes.** The CMS already has viewer, editor, admin and owner. Should
  creating a new Atlas need admin, or can an editor do it?
