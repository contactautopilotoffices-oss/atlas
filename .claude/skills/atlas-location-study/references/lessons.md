# Lessons from earlier studies

What clients and the Autopilot team asked for on the Chennai and Whitefield studies, and what fixed it. Most of these are already built into the template; they are here so you know why, and so you don't undo them.

## What clients notice first

**"These satellite images are too old."** Mapbox's satellite layer was years out of date over Indian cities (new towers missing, old plots shown). The template uses Esri World Imagery for the Satellite chip and the roof crops, reads each pin's capture date, and prints it under the crop. Check the dates with `esri_imagery_dates.py` before the first review; if a building is newer than the imagery, say so in its `facts`.

**"Remove the tentative rent and sq ft."** Quoted rents and areas on the client's sheet were indicative, and a page that shows them reads as Autopilot confirming them. Unconfirmed commercial terms stay in `_sheet` and off the page. Add them later only when the client confirms (in the ATLAS repo, through the admin panel's broker-stated fields).

**"Details need to dim down; I need to see all properties at a glance."** A busy basemap hides the shortlist. The template uses Mapbox Standard with the faded theme, points of interest and transit labels off, and spreads pins that overlap at city zoom, with a thin leader line back to the true position. Don't turn the labels back on to "add context".

**"Bus stops" plus "upcoming metro indicative".** The first note read "bus stops to be replaced with upcoming metro", and taking it literally (removing bus stops) was wrong: the client wanted bus stops kept, with the nearest stop's distance for every building, and the upcoming metro shown as indicative. When a note can be read two ways, take the reading that removes nothing, or ask. The template shows both: a bus layer from GTFS with route counts, and dashed upcoming lines labelled indicative.

**"Studio talent: if it's nil, don't show it."** "0 studios within 30 minutes" reads as a negative verdict. Where a building has no peer employers in reach, the template says nothing about them (no chip, no bar, no column), and the whole measure disappears when the study maps none.

**"Which institutes are these?"** Counts on a chip ("Institutes") made the client ask what was counted. Every place layer has an "i" button listing each place with its locality, why it matters and a source. Write the `note` for each place with the client in mind.

**"An All properties filter."** The map bar has a property picker: tick buildings on and off, or show one fit group, and the list, pins and rankings follow.

## Accuracy

- **Pins.** Check every pin on imagery. First-pass geocodes easily land on the wrong tower of a tech park, or on an operator's head office instead of the centre. Only `building` precision gets a crop.
- **Two brokers, two numbers.** Vacancy for the same city ranged from 6.8% to 12.4% across trackers because each defines stock differently. Use one broker for the zone tables and show the other as `alt` with its name.
- **Openings move.** Metro target dates slip; the template's `opens` date switches a station to open on the day, and `target` text says "reported" with the month it was reported.
- **Drive times are estimates.** The client's sheet gives road distance and drive time from today's office; the page uses those where given and labels its own straight-line estimates "est." everywhere else.

## Weight and speed

The first Chennai page felt heavy on laptops and phones. What helped:
- No continuous animation on the map. A pulsing pin makes Mapbox repaint every frame, which drains phones. Animate on change only.
- 3D buildings off while Satellite is on (they hide the roofs), and the Esri crops cut to the size on screen through the export endpoint, loaded lazily.
- `data.js` written compactly (one item per line, coordinates rounded to 6 places; bus stops as arrays). Keep it under about 150 KB.
- The sign-in backdrop as WebP at 1920 px, under about 150 KB each.

## Access and releases

- **Passwords.** Only SHA-256 hashes go in the repo (`meta.gate.hash`, `clients/manifest.js` `passHash`). The ID and password go to the user in chat. When a password is changed, change both hashes and tell the user the old one stops working.
- **Two studies at once.** Merging two study branches conflicted in `clients/manifest.js` and `vercel.json`, because both add an entry in the same place. Keep both entries, then check `vercel.json` still parses (`node -e 'JSON.parse(require("fs").readFileSync("vercel.json"))'`).
- **Preview first.** Every change went to a branch and a Vercel preview link; the client saw the preview, and main was merged only when the user said so.

## Testing

- Run `check_study.js` before every push: it stubs Mapbox and Esri, so it is quick and doesn't flake on the network, and it signs in through the real gate.
- Look at the screenshots, not just the pass count. Wording problems ("0 studios", a heading naming the wrong kind of talent) pass every automated check.
- With a real token, check the pins at street zoom once per study.

## Talking to the client and the team

Clients send short notes and screenshots. Reply in plain words: what changed, where to look, and the preview link. Lead with the link and the sign-in details when they ask for them; keep technical detail for the PR.
