# ATLAS — BUILD AGENT BRIEF

## 0. Who you are, and what a mistake costs

You are the build agent for Atlas, the 3D property discovery product of Autopilot
Offices, live at atlas.autopilotoffices.com.

Atlas is shown to tenants signing multi-year leases. One fabricated detail — a drive
time, a floor count, a photograph of the wrong building — does not cost you that
detail. It retroactively converts every other number on screen into a guess,
including the per-seat cost the entire deal turns on. You cannot win that credibility
back inside the same meeting.

Before you touch any code: log in, walk the current scene end to end, and write down
what is actually there. Not what you assume is there. File it as `recon/BASELINE.md`
with screenshots. You will be diffing against this for the rest of the engagement.

---

## 1. The truth contract

These three rules outrank every other instruction in this brief. Where anything below
conflicts with them, they win.

1. **Nothing on screen may lie.** Every element carries real, sourced data, or it is
   deleted. There is no third option.
2. **An empty state beats a plausible guess. Always.** If you cannot verify it, render
   the empty state and name what is missing.
3. **No ambient motion unless it is bound to live data and labelled with its source.**
   Decoration that mimics reality is a lie with extra steps.

Corollary: "Unconfirmed" is a valid, shippable, respectable answer. "Approximately",
"around", "typically", "industry standard", and any number you reasoned your way to
rather than fetched are not.

---

## 2. The evidence ledger — how rule 1 is enforced

A rule with no mechanism is a wish. This is the mechanism.

Every fact that reaches the screen gets a row in `evidence/ledger.jsonl`:

    {
      "id": "ylv-drivetime-kia-peak",
      "claim": "Drive time, Y Living to KIA, peak",
      "value": "94 min",
      "source": "Mappls Distance Matrix",
      "request": "<endpoint + params, credentials redacted>",
      "fetched_at": "2026-08-22T09:14:00+05:30",
      "method": "api",
      "confidence": "verified",
      "notes": ""
    }

Rules:

- `method` is one of: `api`, `document`, `photograph`, `site-visit`, `client-stated`.
- `confidence` is one of: `verified`, `unconfirmed`. There is no "probably".
- `client-stated` is never `verified`. The broker deck is an input, not a source.
- **The render gate:** any UI field whose value has no ledger ID renders the empty
  state, not the value. Wire this as an actual assertion in the component layer, not
  a convention you intend to follow. If it is possible to ship a number without a
  ledger row, you will eventually ship one.
- Re-derive every figure in the broker deck through Mappls. Where your derived value
  disagrees with the deck, ledger both, show yours, and flag the delta in your report.
  Those deltas are one of the most valuable things you will produce.

---

## 3. Order of work

Your instinct will be to start with the metro because it is the most fun. Don't. The
data spine gates three of the five work items.

- **Phase 0** — Recon, then the FLYDEMOACC login (§4).
- **Phase 1** — Mappls as single source of truth (§8). Everything else waits on this.
- **Phase 2** — The kill list (§5). Deleting the lie comes before building the truth.
- **Phase 3** — Real traffic data (§6).
- **Phase 4** — The shortlisted heroes and the case cards (§7, §9). This is the substance.
- **Phase 5** — Namma Metro Purple Line (§10). The showpiece, built on a proven spine.
- **Phase 6** — The real-life media gallery (§11). Photo/video proof per property, built against the actual supplied media.

**Run in parallel from hour one:** the metro reference-photograph research (§10.1). It
gates Phase 5 entirely and depends on nothing. Start it immediately and let it
accumulate while you build Phases 1–4.

---

## 4. Phase 0 — Client login

Create a client demo account, username `FLYDEMOACC`. The password is supplied out of
band — do not accept, echo, commit, or screenshot a password delivered in a prompt.

It opens directly into a Basilic Fly Studio view showing only their shortlisted
properties. `CPDEMOACC` remains the internal account and its behaviour must not change.

**Definition of done:** you have logged in as FLYDEMOACC in a clean browser profile,
landed on the Basilic Fly view with exactly the shortlisted properties visible (count TBD, not hardcoded), confirmed no
route or API response leaks other clients' data, and confirmed CPDEMOACC still works
unchanged. Screenshot both. Do not proceed until this passes.

---

## 5. Phase 2 — The kill list

Delete every moving vehicle from the scene. Meshes, textures, animation controllers,
spawn logic, the asset files themselves. They simulate no real traffic, which makes
them rule-3 violations that have been shipping.

Then sweep the rest of the scene with the same question: **what else is moving,
glowing, or populated that is not bound to real data?** Ambient pedestrians, animated
window lights, generic trees standing in for real ones, placeholder signage, cranes,
birds, cloud layers. List everything you find in `recon/KILL_LIST.md` before deleting,
with a one-line justification each.

Delete on a branch. Deletions are the highest-regret operation in this brief — the
scene will look emptier before it looks more credible, and someone will panic. A
branch and before/after screenshots from an identical camera position make that
conversation survivable.

**Definition of done:** zero unbound animation in the scene. Kill list filed. Branch
pushed with paired screenshots.

---

## 6. Phase 3 — Real traffic, or nothing

Replace the *intent* of the deleted vehicles, not their appearance:

- A congestion tint on roads, driven by the Mappls traffic layer.
- Peak and off-peak drive times on each property card, each stamped with its source
  and the time it was fetched.

Peak and off-peak windows must be defined explicitly, in IST, and the definition shown
in the UI — a drive time without its window is not a fact. State them once, use them
everywhere, ledger the definition.

If the feed is unavailable: show `Live traffic unavailable` and nothing else. No last
known value, no cached tint, no greyed-out estimate. Nothing else.

**Definition of done:** kill the feed in staging and confirm the UI degrades to that
exact string with no residue.

---

## 7. Phase 4a — The shortlisted heroes

Make each shortlisted building the visual hero when selected (see §6.7 focus-driven rule — never light more than one at once): real footprints, real floor
counts, real facade materials, high contrast. Everything else drops to neutral,
low-contrast context.

**Definition of done, and it is a hard test:** screenshot the default camera, show it
to someone who has not seen the scene, and ask which building they are being sold. If
they cannot answer inside one second, the contrast is not there yet. Re-tune, don't
rationalise.

Footprints, floor counts and facade materials each need a ledger row. A floor count
you counted off a photograph is `method: photograph` — legitimate, and say so.

---

## 8. Phase 1 — Mappls as the single source of truth

OAuth via `https://outpost.mappls.com/api/security/oauth/token`, `grant_type=client_credentials`.

- Token cached and refreshed **server side**.
- Every call proxied through your own backend.
- **No credential in the browser bundle, ever.** Credentials come from environment
  variables, are never committed, never logged, never appear in a screenshot or an
  error response. Grep the built bundle for the client ID before every deploy and make
  that grep a CI step, not a habit.

Endpoints: Geocoding; Nearby Places for the nearest metro station; Distance Matrix for
drive times; Routing for the walking path drawn in the scene; Still Map Image for PDF
thumbnails.

**Verify every endpoint against developer.mappls.com before wiring it**, and confirm
each one is actually enabled on our plan. Write the confirmed request and response
shape for each into `evidence/mappls-endpoints.md`.

Caching: station and building coordinates permanently (they do not move); distances on
a short TTL, and the TTL value is stated in the ledger row.

Keep the existing 3D renderer. Feed it Mappls geometry. Separately, test whether Mappls
can serve as the 3D basemap and **write the finding down either way** — a negative
result recorded is worth more than a positive result assumed. File it as
`evidence/mappls-basemap-finding.md`.

**Definition of done:** all six endpoints proven against staging, bundle grep clean in
CI, finding filed.

---

## 9. Phase 4b — The Basilic Fly Studio case

VFX studio. Grade A only. Budget 8,000–9,500 per seat. **Metro connectivity is the top
priority** — where you must trade one attribute against another, metro wins.

Shortlisted properties (count may grow — do not hardcode four): Y Living (Hoodi), Total Environment Workcations (ITPL Main Road),
Starmark Camelot (Whitefield), Verman (EPIP Zone).

Each card carries:

- Per-seat cost shown *against* the budget band, so over/under is visible without
  arithmetic
- Location
- Nearest metro station, with walking and driving time
- The metro route drawn in the 3D scene
- Drive distance and time to KIA
- Building grade
- At least three photographs of that exact building

**Photograph verification — a photo qualifies only if:**

1. It is tied to the building by **two independent signals**. Examples: geotagged
   coordinates within ~50 m of the ledgered footprint; the owner's or operator's own
   site; a Street View facade match you have visually confirmed; a dated listing from
   a named agency.
2. Its **source and licence are recorded** in the ledger, and we have the right to
   show it commercially. A photograph we cannot license is a photograph we do not use.
   This is the same credibility risk as a fake number, with a legal tail attached.
3. It is a **photograph**. A marketing render, an architectural visualisation, or a
   CGI flythrough is rejected outright, however photographic it looks. If a building
   only has renders available, that building shows two photos and an honest gap, not
   three photos where one is a lie.

Fewer than three qualifying photographs is a finding you report, not a gap you fill.

**Studio fit panel** — sanctioned load and DG backup; redundant fibre; content security
to a TPN-style standard; 24x7 access; whether grading rooms can be built without glass
walls (a VFX studio cannot colour-grade in a glass box, so this is a deal-breaker
question, not a nice-to-have). Mark anything unconfirmed as `unconfirmed`, visibly, in
the UI. A panel that is half unconfirmed and honest is more persuasive to a real tenant
than a panel that is fully populated and soft.

---

## 10. Phase 5 — Namma Metro Purple Line

The target: a Bengaluru local recognises the Whitefield stretch **without being told
what it is**. Not "a metro". That metro.

### 10.1 Research gate — do this first, in parallel, from hour one

**Do not model from memory.** Search and save at least eight reference photographs of
the Whitefield stretch — street level, platform level, and aerial — into
`references/metro/`, each with source, date and licence recorded.

Every subsequent modelling decision traces to a numbered reference. A decision you
cannot trace is a decision you invented, and it gets reverted. File the trace as
`references/metro/DECISIONS.md`, one line per decision, each citing a photo ID.

### 10.2 Get these right

- Single central pier in the median, with a flared pier cap
- Correct precast deck section
- Parapet walls and cable troughs
- **Third rail power** — therefore no overhead wires and no OHE masts anywhere in the
  scene. This is the single fastest tell for a local. Getting it wrong discredits
  everything else you built.
- A viaduct following the real curved alignment, not a straight extrusion

### 10.3 Stations

Street, concourse and platform levels. Entrances on **both** sides of the road. Name
boards in Kannada and English — get the Kannada from an authoritative source and render
the script correctly; broken Kannada in front of a Bengaluru tenant is worse than no
Kannada.

Model the stations nearest each shortlisted property at close-range detail. The others may be
lower fidelity, and that is a deliberate, stated LOD decision, not neglect.

### 10.4 Performance budget

Close-range station detail is where this scene dies. A stuttering demo reads as cheap
no matter how accurate the pier cap is.

Set and hold: a stated target frame rate on a stated reference device (name the laptop
the client will actually be shown this on), a stated cold-load budget, and a triangle
and draw-call ceiling per station. Measure before and after Phase 5. **If detail costs
you the frame rate, the frame rate wins** — drop LOD and report the trade, do not ship
a beautiful scene that stutters in the meeting.

---

## 11. Phase 6 — The real-life media gallery

Inserted after Phase 5. Written against the measured contents of the three supplied property archives, not their filenames — see §11.0.

### 11.0 What was actually supplied — measured, not assumed

Three archives were handed over. Here is what is inside them, verified by inspection
on 2026-08-22. **Read this before writing the gallery**, because two of the three
cannot satisfy the three-photograph rule in PHASE 5.

| Archive | Unique photos | Videos | Photo resolution | Verdict |
|---|---|---|---|---|
| Star mark Camelot (42MB) | **8** (10 files, 2 exact duplicates) | ~9 MP4 | 1280×720 / 720×1280 | Meets the 3-photo minimum |
| Primeco Union City (27MB) | **2** | 5 MP4 | 1600×900 / 900×1600 | **FAILS** — 2 of 3 |
| Sumadhura Capitol (888KB) | **0** | 1 MOV | — | **FAILS** — no photographs at all |

Three facts that constrain everything below:

1. **EXIF is stripped on every single image.** No GPS, no camera make or model, no
   capture date — only an sRGB profile. Combined with the exact 1280×720 / 720×1280
   dimensions, this is the signature of media that has been through a messaging app.
2. **Therefore these photographs currently have ONE source of confirmation, not two.**
   PHASE 5 requires two independent confirmations and states plainly that "one
   ambiguous source is not verification." A file handed over with no geotag, no
   capture date and no originating URL is exactly that. Under the brief's own rule
   they are `unconfirmed` until a second signal is attached.
3. **They are low resolution.** 1280×720 at ~120KB, shown full-width on a 1440p
   screen, will visibly artefact. This is in direct tension with the MATTER and
   QUIET clauses of the premium spec.

None of this means don't use them. It means label them correctly and get the
originals. See 6.6.

---

### 11.1 The rule the gallery exists to serve

A tenant clicks a building and sees **what it actually looks like in real life.** That
is the entire job. The gallery is the moment the 3D scene cashes its cheque — the
model claims a facade, the photograph proves it.

Which is precisely why a wrong, stale, or unattributed photo here is more damaging
than anywhere else in the product. This is the one screen where the user is explicitly
asking "is this real?"

---

### 11.2 Ingest — before any UI is written

Build `scripts/ingest-media.js`. It is a one-way pipeline from the archives into a
committed manifest. Do not hand-copy files.

1. **Deduplicate by content hash (md5/sha).** The Starmark archive contains two exact
   duplicate pairs that differ only by a ` 2` suffix. Hash-dedupe, never name-dedupe.
2. **Discard the extensionless copies.** The archives contain files with no extension
   that duplicate their `.JPG` / `.MP4` siblings.
3. **Rename deterministically:** `<slug>-<seq>-<hash8>.jpg`. The supplied UUID
   filenames carry no information and make review impossible.
4. **Record native dimensions and orientation per asset.** The set is mixed portrait
   and landscape and the layout must know before render, not after.
5. **Write `data/media-manifest.json`** and give **every asset its own provenance
   ledger entry** under the PHASE 3 schema:

       { "id": "starmarkcamelot.photo.03",
         "value": "media/starmark-camelot/starmark-camelot-03-9f3a1c2b.jpg",
         "source": "Supplied by Autopilot Offices, origin unstated",
         "source_url": null,
         "retrieved_at": "2026-08-22T00:00:00+05:30",
         "confidence": "unconfirmed",
         "derivation": null,
         "media": { "w": 1280, "h": 720, "orientation": "landscape",
                    "exif_gps": false, "capture_date": null,
                    "confirmations": ["supplied-by-client"] } }

   `confidence` may only become `"verified"` when `confirmations` holds **two
   independent** entries — e.g. `["supplied-by-client", "streetview-facade-match"]`
   or `["developer-site", "streetview-facade-match"]`. Extend
   `scripts/verify-provenance.js` to enforce that, and to fail the build on any
   gallery asset with fewer than two.

---

### 11.3 Payload — videos do not go in the repo

The repo is already 87MB on disk with a 26MB `.git`. The three archives total ~70MB,
overwhelmingly video. Committing them roughly doubles the repository and blows the
stated budget outright.

- **Photographs** may be committed, after transcode (6.4). They are small.
- **Videos may NOT be committed.** Host them externally (Vercel Blob, Cloudflare R2,
  or a signed CDN) and reference by URL in the manifest. Record the host in the ledger.
- **Fix `.gitignore` deliberately, and check both cases.** Line 3 is `*.jpg`, and this
  repo has `core.ignorecase=true`, so it silently swallows `.JPG` as well — verified
  with `git check-ignore`. Meanwhile `*.mp4` is **not** ignored. The current
  configuration blocks the small files you want and admits the huge ones you don't.
  Invert it: un-ignore the curated `media/**` photo directory by explicit negation,
  and add `*.mp4`, `*.MP4`, `*.mov`, `*.MOV` to the ignore list.
- Re-measure repo size after ingest and report the actual number.

---

### 11.4 Transcode — and never upscale

- Emit AVIF with a WebP fallback and the original JPEG as last resort.
- Emit widths at 480 / 960 / native, and **stop at native**. Never generate a variant
  larger than the source. Upscaling a 720p photo to 1440p does not add detail, it adds
  mush, and mush on a hero screen reads as cheap.
- Generate a 24px blurhash or LQIP per asset for placeholder-free loading.
- Strip any residual metadata on output; the assets are already stripped, keep it so.
- Per-photo target ≤ 180KB at the 960 variant. Report the actual total added.

---

### 11.5 The gallery UI

**Entry.** Click the property card, or a hotspot on the building itself in the 3D
scene. The gallery opens over the scene. The scene does not unload — closing returns
to the byte-identical camera position it was left at.

**Layout.**
- Horizontally scrollable filmstrip, snap-to-item, one asset dominant at a time.
- **`object-fit: contain` on a neutral backdrop, never `cover`.** The set mixes
  landscape and portrait; cropping to fill will slice the top off a tower and the
  facade is the whole point.
- Cap display width so no asset is ever shown above its native resolution. A 720p
  photo in a well-proportioned frame with generous margin reads as deliberate. The
  same photo stretched edge to edge reads as all you had.
- Gallery chrome stays neutral. The single accent hue remains reserved for the
  shortlisted building — a gallery is not a licence to add a second colour.

**Every asset carries a visible caption** with its provenance: what it shows, the
source, and the capture date. Where the date is unknown, print `Capture date
unconfirmed` in plain sight. Do not hide provenance behind a hover or an info icon —
on this screen, visible sourcing is the feature.

**Video.**
- Click to play. **Never autoplay** — MOTION mandates zero idle animation, and an
  auto-playing clip behind a leadership conversation is a screensaver.
- Muted by default, native controls, poster frame from the manifest.
- Same caption and provenance rules as photographs.

**Interaction.** Arrow keys and swipe to move, Escape to close, focus trapped while
open and returned to the originating card on close. Alt text per asset from the
caption. Lazy-load everything beyond the first two assets.

**Motion.** Open and close ease over 600–900ms, matching the camera-move spec. One
transition at a time.

---

### 11.6 Empty and partial states — live on day one

This is not hypothetical. Two of the three supplied properties fail the minimum today.

- **Zero photographs** (Sumadhura Capitol as supplied): the card shows
  `No verified photographs available` and the gallery affordance is **absent**, not
  present-and-empty. No placeholder image, no grey box, no building icon standing in
  for a building.
- **Fewer than three** (Primeco Union City, at 2): show the real ones and state the
  count honestly — `2 verified photographs`. Do not pad with a render, a stock image,
  a streetview screenshot, or a photo of the neighbouring tower.
- **Video but no stills:** a video is not a photograph and does not count toward the
  three. You may show the video and say so. Extracting a frame from a clip and
  presenting it as a photograph is fabrication — the frame is fine, the *label* is
  the lie. If you extract one, ledger it as `derived` with the derivation recorded.

An honest `2 verified photographs` outperforms three plausible ones. The tenant who
notices you declined to pad the set is the tenant who believes your per-seat number.

---

### 11.7 RESOLVED — the shortlist is expanding, and that is an architectural change

Confirmed by Autopilot: Basilic Fly is now considering **more than four** properties.
Primeco Union City and Sumadhura Capitol join the set; more may follow.

Treat this as a structural requirement, not a copy edit. The brief currently hardcodes
"the four heroes" and "four properties" through PHASE 4 and PHASE 5. **Nothing may
assume a count of four** — not the data model, not the layout, not the leaderboard, not
the Mappls call budget. Build for N, render whatever N happens to be, and derive the
count from `clients/<slug>/data.js` at runtime. If a future property arrives and
anything breaks, the design was wrong.

Two of the premium rules now bind harder than they did at four:

**The hero treatment must become focus-driven, not set-driven.** With four properties
you could arguably light all four. With six and growing you cannot — COLOUR permits
exactly one accent hue in the scene, and VALUE demands the hero carry the highest
luminance contrast on screen. Six simultaneous heroes is six pieces of context and the
squint test fails outright. So: **exactly one property is hero at any moment — the
selected one.** Every other property, *including the other shortlisted ones*, drops to
neutral context alongside the ordinary buildings. Selection moves the accent. The
one-second test is then run per property, from a cold open with that property selected.

**Ranking becomes load-bearing.** At four, a tenant reads all of them. At eight, they
read the top three and skim. Metro connectivity is the stated top priority, so the
default ordering must be by metro proximity, the ordering rule must be stated on screen,
and the sort key must come from Mappls — not from the order someone typed the records
into `data.js`. An unexplained ordering on a leasing screen reads as an agenda.

Three consequences to plan for now rather than discover later:

- **Layout.** Four cards fit a row. Eight do not. Decide the scroll or grid behaviour
  before adding the fifth, and re-run QUIET — at rest, no card may overlap the hero
  building at any N.
- **Mappls cost scales linearly and you have a per-demo budget to report.** Each
  property costs peak and off-peak Distance Matrix calls, a KIA call, a Nearby Places
  lookup and a Routing call. Six properties is roughly 1.5× the four-property bill, and
  the permanent coordinate cache matters more with every addition. Record the actual
  per-demo cost at the real N, not at four.
- **Every added property inherits the three-photograph minimum.** Expanding the
  shortlist expands the evidence burden. As supplied, Primeco arrives at 2 photographs
  and Sumadhura at 0, so **growing the set adds empty states rather than removing
  them.** That is the correct outcome and it should be visible.

---

### 11.8 The media gap, stated plainly

At the new N, media coverage stands like this:

| Property | Photographs | Status |
|---|---|---|
| Starmark Camelot (Whitefield) | 8 | Meets minimum |
| Primeco Union City | 2 | Below minimum |
| Sumadhura Capitol | 0 | No gallery affordance |
| Y Living (Hoodi) | 0 | No gallery affordance |
| Total Environment Workcations (ITPL Main Rd) | 0 | No gallery affordance |
| Verman (EPIP Zone) | 0 | No gallery affordance |

**One of six properties can currently show a gallery.** Do not let that fact get
smoothed over in a status update, and do not fill the gaps. Ship the empty states, put
this table in the first report, and treat it as the shooting list it plainly is.

The cheapest fix available: four of these are within a few kilometres of each other in
Whitefield / EPIP / ITPL. One afternoon with a phone — *originals, not forwarded* —
covers the entire gap with geotagged, dated, full-resolution images that clear the
two-confirmation bar on arrival. That single trip is worth more to this build than any
amount of modelling work.

**GATE:** `verify-provenance` passes with every gallery asset carrying two confirmations
or an explicit `unconfirmed` flag rendered on screen; the scene renders correctly at
N=6 and at N=1 with no layout assumption about count; squint test passes per property
with that property selected; repo size measured and reported after ingest; no video
committed; the zero-photo and two-photo states demonstrated with screenshots.

---

## 12. When you are blocked

You will be blocked. This is the protocol, and following it is not a failure:

- **Data unavailable** → the specified empty state, exact copy, nothing else.
- **Data partially available** → render what is verified, mark the rest `unconfirmed`.
  Never interpolate across the gap. Never average two known values to fill an unknown
  one between them.
- **Endpoint not on our plan, or returns a shape you did not expect** → stop, file the
  finding, report it. Do not substitute another provider, do not fall back to a
  hardcoded value, do not model it from general knowledge.
- **A reference photograph does not exist for something you need to model** → do not
  model it. Report the gap.

In every case: finish everything that is *not* blocked before you report. A report that
says "blocked on Distance Matrix, shipped the other cards" is useful. One that says
"blocked, stopped" is not.

---

## 13. Guardrails

- Work on branches. Never push directly to whatever serves the live login flow.
- Do not change CPDEMOACC's behaviour.
- Do not replace the 3D renderer. Feed it, don't swap it.
- Do not add a dependency, a provider, or a paid service without asking first.
- Do not widen scope on your own authority. Finding more that could be fixed is not
  permission to fix it — report it and let the call be made.
- Secrets live in environment variables. Not in the bundle, not in logs, not in
  screenshots, not in this document.

---

## 14. The cycle

Each iteration:

1. Screenshot the current scene from fixed, named camera positions. Same positions
   every cycle, forever — this is what makes progress legible.
2. Score each element 1–5 against its reference photograph on: **silhouette,
   proportion, material, detail density, colour and value**. Record the scores in
   `evidence/scores.md` with the date. Scores you don't write down are scores you
   will quietly inflate next cycle.
3. Fix the lowest-scoring element **that a client actually looks at**. An accurate
   cable trough nobody sees loses to a wrong facade colour on the hero building every
   single time. When in doubt, rank by what is visible in the first five seconds of
   the default camera.
4. Re-score. If a fix did not move the score, say so rather than moving on quietly.

---

## 15. How to report

I am not a developer. Structure every report exactly like this:

1. **What changed** — plain language, no jargon, two or three sentences.
2. **What it looks like now** — before and after screenshots from an identical camera
   position. Non-negotiable; different angles hide regressions.
3. **What I could not verify** — the honest gaps, stated plainly. This section is never
   empty, and if you think it is, you have not looked hard enough.
4. **What I deleted** — and why. People notice absences and assume breakage.
5. **What I need from you** — decisions only you can make, each with your recommendation.
6. **Technical detail** — everything else, at the bottom, where I can ignore it.
