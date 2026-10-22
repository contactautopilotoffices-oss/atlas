# Research sources and how to check them

Every figure on an ATLAS page is read by the client as Autopilot's claim. The rule: a source URL, the date the figure was true, and a precision or confidence that is no better than you actually know. When a figure can't be sourced, leave it off; "Not published for this micro-market" is a fine answer.

## Pinning buildings

Goal: the pin on the right roof, or an honest lower precision.

1. **Find candidates.** Search the building name plus locality in OpenStreetMap (Nominatim: `https://nominatim.openstreetmap.org/search?q=...&format=json`, set a User-Agent, one request a second), the developer's site (often has a Google Maps embed with coordinates), leasing portals (address, floor count, photos) and Exa's place library if available.
2. **Confirm on imagery.** Look at the candidate on Esri World Imagery (the export URL pattern is in `app.js`, `satUrl`) or Google satellite. Match the footprint, floor count, a distinctive roof or podium, and the access road. A tech park has many towers: pin the tower the option is about, and say which in `facts`.
3. **Set precision.**
   - `building`: footprint and identity confirmed by two independent signals (an OSM building or developer map, and imagery that matches the listing photos).
   - `street`: on the right road and block, but the tower or building is not certain.
   - `locality`: only the neighbourhood is known (common for under-construction or vaguely listed buildings).
4. **Record `geoSrc`**: the URL of the thing that confirmed it (OSM way, developer map, listing).

Watch for: two buildings with the same name in different cities; "near X" addresses that are 2 km from X; old Google pins on plots that have since been rebuilt; coworking centres listed at the operator's head office instead of the centre.

## Today's office

Use the client's annual report, MCA filings or website for the registered or corporate address, then pin as above. If the client gives the address, that is the source.

## Micro-markets

- Pick 3 to 6 zones that cover the shortlist. Use the market's own names (the broker reports' sub-markets), not invented ones.
- **Rent, vacancy, stock from one source** so they compare like for like across zones: a broker's city report (Savills, CBRE, JLL, Cushman & Wakefield, Colliers, Knight Frank) or a REIT's industry report, which is often public (Mindspace, Embassy, Brookfield REIT filings carry the broker's sub-market tables).
- Newer figures from a different broker go in `alt`, labelled with the broker and period, because their stock definitions differ and the numbers won't match.
- Pros and cons: one fact each, specific to this client's kind of office. Cite in `sources`.
- Occupiers: named tenants with a source (leasing news, REIT tenant lists).
- Outlines are indicative; draw bands along the corridor the zone is known by.

## Rail and metro

- **Open lines:** GTFS from the operator or a community feed (the ChennaiGTFS repo, Delhi Open Transit Data, BMRCL data on GitHub), else OSM stations, else Wikipedia station lists with coordinates. Note in the line's `note` where coordinates and colours came from; colours from Wikipedia line templates are not official brand codes, say so.
- **Upcoming lines:** the metro authority's DPR or press releases for the route and station list; news for the latest target dates. Station positions are often approximate: say "indicative" in the note. Put the target as reported ("Mar 2027, reported Aug 2026"), and the year in `eta`.
- **Openings:** if a section opens on a known date, set `opens: "YYYY-MM-DD"`; the page switches it to open on that date without a redeploy.
- **Suburban rail and MRTS** go in as their own lines with `mode: "suburban"` or `"mrts"`; they count for "rail today" but not for "metro coming".

## Bus stops

The city bus operator's GTFS feed, from the operator, a transit data portal, or a community scrape (credit it as its licence asks, e.g. ODbL). Run `gtfs_bus_stops.py`, then compare the printed nearest stops with a map: a stop 1 km away when you can see a bus stop outside the building on Street View means the feed is incomplete there; say so or drop the bus layer. Route counts are distinct route numbers after folding short-trip variants, written "about N routes".

## Talent and peer employers

- **Institutes (`edu`)**: the ones that actually feed this client's roles: for engineers, the engineering colleges; for VFX, the animation and fine-arts colleges. A line in `note` saying why each matters.
- **Residential belts (`res`)**: neighbourhoods where staff at this pay level live; `locality` precision; cite a housing or news source on why.
- **Peer employers (`studio`)**: direct competitors for the same people (studios, GCCs, banks). Size lines (headcount, floor area) only from the company's own pages or filings, dated.
- **IT parks (`it`)**: big employers competing for the same technical pool.

Drive time to each is estimated from straight-line distance, the road factor and `meta.speed`; the page says so. For speed, use a published congestion index (TomTom Traffic Index city page) and state the factor.

## Satellite imagery

Esri World Imagery is usually years newer than Mapbox's satellite layer in Indian cities. `esri_imagery_dates.py` reads the capture date at each building pin from the public `identify` endpoint (no key). The page re-checks live when an option opens. Credit line: "Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community".

## Market, talent and transit facts

Short headline facts with a period and a confidence:
- `high`: an official or primary source (operator, government, company filing).
- `medium`: a reputable broker or newspaper quoting one.
- `low`: a single secondary source, or figures that disagree between trackers. Say so in `note` ("other trackers report 8.5% to 12.4% because of different stock definitions").

## Commercial terms

Rent, CAM, available area, floors and lock-in from the client's sheet are often tentative. Keep them in `_sheet` (never shipped) unless the user says the client has confirmed them. In the ATLAS repo, confirmed broker figures can be added later through the admin panel, which labels them "broker-stated" with a date.
