# 01: Intake. Ask before building.

Most first-timers skip this, and it is the stage that saves the most time.
Ask in one message, as multiple choice where you can (AskUserQuestion), and
write the answers into `BRIEF.md`. Don't start rendering until the items
marked ★ are answered. Everything else gets a sensible default, and the
brief says which default you chose.

## The questions

**Who and what**
- ★ Who is the client, and who is the film for (the client's real-estate
  team, their CXO, a public launch)?
- ★ Which properties are in the film, and in what order? Who supplied the
  data deck?
- Is there a brand pair, such as Autopilot × Flipkart? Ask for logo files
  (SVG, transparent), the colours and the font.

**Where**
- ★ What is the lat/lng (or Google plus code) of each building's door? A
  complex's pin is not the tower.
- Which are the nearest metro or rail stations and lines? Which entrance
  do people actually use?
- Do any buildings nearby matter for the story (landmarks, a rival's
  tower)?

**How they want to go about it** (offer these as choices)
- Format:
  - a film only;
  - a film, then property cards, then the 3D explorer (the Andheri flow);
  - stills only;
  - an interactive page only.
- Length: 60 s teaser, 2 to 3 min walkthrough, or a long version with the
  floor plans.
- Style:
  - storyline options in words: a descent from cloud, a street-level
    commute, or day to dusk;
  - three storylines, and the founder picks one.
- Time of day per property: sunrise, afternoon, dusk or night. Remember
  that a north-facing facade in India gets no sun from November to
  February.
- Voice:
  - none, a narrator or captions only;
  - which voice (play two auditions);
  - which language or mix (Hindi lines such as "Pehle vyavahar, phir
    vyapar").
- Music mood, and whether to allow sound on the web page (start muted?).
- Numbers to show: carpet area, seats per option, floors, walking
  distance and minutes, rent (usually not).
- Deadline, and where it is delivered: an mp4 file, a deployed link, or
  embedded in an existing atlas.

**Truth and limits**
- Which source wins when the deck, the map and the developer disagree?
- Is anything confidential (rent, floor numbers before signing)?
- What may be published: no Google imagery, and the third-party asset
  licences?

## The canonical table

One table, and every later stage reads from it:

| Property | Floors offered | Carpet sq ft | Seats (options) | Nearest station | Walk m / min | Source |
| -------- | -------------- | ------------ | --------------- | --------------- | ------------ | ------ |

When a measured figure differs from the deck (for example the walk
measured on OSM against the deck's figure), keep both and ask. The Andheri
example is in `andheri-project/film/MORNING-NOTES.md`, under "Questions
only the founder can answer".

## Storyline (before any SPEC)

Write three different films in words, five lines each. The founder picks
one. Then write the script line by line, timed against the picture slots
(Andheri: 140 s, 15 lines; see `andheri-project/film/SCRIPT.md`). Before
recording, read every claim in the script back against the canonical
table. ("One stop west" was wrong: it is two stops.)
