# JindalX Noida: metro distances checked

24 November 2026. The client's sheet gives a metro distance for each option. We measured the real walk from each
building's gate to its nearest Blue Line station and compared it with an independent walking router.

## Result

| Option | Nearest station on foot | Sheet says | Our walk | Independent router | Our walk vs sheet | Verdict |
|---|---|---|---|---|---|---|
| A104 (Sector 4) | Noida Sector 16 | about 800 m | 1,210 m, 15 min | agrees, ours 3 to 7% longer | +410 m (+51%) | **Sheet is too short.** 800 m is the straight line (735 m). Nobody can walk it. |
| A14/18/19 (Sector 9) | Noida Sector 16 | 1.9 km ("~2 km") | 1,740 m, 22 min | agrees, ours 3 to 6% longer | -160 m (-8%) | **Sheet is a little long.** Real walk is about 1.7 km. |
| D1 (Sector 3) | Noida Sector 16 | 500 m | 630 m, 8 min | agrees, ours 2 to 8% longer | +130 m (+26%) | **Sheet is a little short.** Between the straight line (390 to 440 m) and the walk. |
| Magnus Towers (Sector 67) | **Noida Sector 61** (the sheet names Sector 59) | about 2 km, Sector 59 | 2,110 m to Sector 61, 26 min; 2,380 m to Sector 59, 30 min | agrees on Sector 61 (ours 1 to 3% longer); Sector 59 ours 3 to 11% longer | +110 m (+5%) to Sector 61; +380 m (+19%) to Sector 59 | **About 2 km is fair, but Sector 61 is the nearer station on foot**, not Sector 59. |

Our walks use the building's gate, round to 10 m, and assume 4.8 km/h (80 m a minute).
The exact distances from the independent router are not stored here (its terms do not allow keeping them). The
column states how our figure compares with it.

What the checks show:
- **Three of four sheet figures are optimistic or loosely rounded.** A104 and D1 are close to straight-line
  distances, which is how a quick estimate is usually made. A14/18/19 is the only one the sheet over-states.
- **Our figures agree with the independent router to within about 8%** (11% in one case, Magnus to Sector 59). They are
  not bent to match the sheet.
- **Straight line against walk:** A104 is 735 m as the crow flies and 1,210 m on foot (1.65 times). The
  Sector 16 industrial blocks have few through lanes, so a walker zig-zags.

## Stations

Names as the Delhi Metro uses them for this stretch of the Blue Line: Noida Sector 15, Noida Sector 16, Noida Sector 18,
Botanical Garden, Noida City Centre; then Noida Sector 59, Noida Sector 61, Noida Sector 62 on the Electronic City branch.
(Google shows the last three as "Sector 59 Noida" and so on: same stations.)

- The Overture Maps station points for Sector 15, 16, 59 and 61 sit within 6 to 26 m of the positions Google gives. Overture
  has one point per station, not separate entrances, and neither source marks the gate numbers, so every walk ends at
  the station point on the nearest street.
- Sector 18 and Sector 62 are outside our street extracts. Both are checked the other way: the independent router puts
  Sector 18 well over 2 km from A104, A14/18/19 and 1.6 km or more from D1; Sector 62 is over 3 km from Magnus. Neither can be nearest.
- **A104, A14/18/19, D1:** Sector 16 is the nearest on foot and in a straight line. Sector 15 is 170 m further for A104,
  700 m for A14/18/19, 160 m for D1.
- **Magnus Towers:** Sector 61 and Sector 59 are almost level (straight line 1,698 m and 1,695 m). On foot Sector 61
  wins by 270 m in our network and by roughly 100 to 200 m in the independent router. If the three entrance bays on the building's road front open to
  pedestrians, the walk shortens by about 150 m to both, and Sector 61 still wins (1,960 m against 2,230 m).

## Where each walk starts

The gate, not the map pin. Gates are the entrances seen in Street View and satellite imagery, as recorded in the
site files (`scripts/world/refs/noida_jindalx.json`).

| Option | Gate used | Confidence |
|---|---|---|
| A104 | steel sliding gate on the narrow west lane | Medium. Which building is A-104 is itself inferred (low confidence). The other candidate building, 80 m south-east, gives 1,260 m: the same conclusion. |
| A14/18/19 | front forecourt on Amaltash Marg (the A-14 plot only) | Medium. The rear-lane gate is unverified and not used. |
| D1 | north-west entrance beside the round corner tower (the south-west gate is 15 m further) | Low to medium |
| Magnus Towers | construction gate on the east road | Low. No gate was seen in the road-front wall. |

The two gates of D1 give 630 m and 640 m, so the choice hardly matters.

## Method

1. **Stations.** The station points come from Overture Maps (`subway_station`) and were compared with the independent
   router's geocoder.
2. **Our route.** `scripts/world/routes.py` builds a walking network from every Overture street segment (footways
   included) in the region and finds the shortest path. This update changes three things:
   - The walk starts at the gate, snapped to the nearest point on a street (before: the nearest street corner,
     up to about 100 m off).
   - The walk ends at the station point snapped the same way, and the two stations offered are the two with the
     shortest walk (before: the two nearest in a straight line).
   - A vehicle underpass is not a footpath (see below).
3. **Independent check.** The same gate and the same station point were sent to Google's walking router. Its routes
   were compared with ours on the map, street by street. Nothing from it is kept in the repository: only Overture routes
   are stored in `jindalx/world-routes.json`.

### The Rajnigandha Underpass correction

Our first run put A14/18/19 at 1,470 m, 15% under the independent router. The map showed why: our network let the walker
use the service lane beside the Rajnigandha Underpass in Sector 16. The router sends a walker around a block instead. The
underpass is a vehicle trench with ramps, so the lane beside it is not a through footpath. The script now leaves
out segments named "Underpass" and unnamed lanes that run alongside one (10 segments in the Sector 3, 4 and 9 area, 8 in the Sector 67
area, which holds the Vishwakarma Road Underpass). After that A14/18/19 comes to 1,740 m, within 3% of the router.
The same change moves A104 from 1,150 to 1,210 m and Magnus-to-Sector-59 from 2,330 to 2,380 m. It is a judgement call
made on the map, not on the ground: a site visit would settle whether the lane is open to pedestrians. If it is, the
A14/18/19 walk is 1.5 km; either way it is under the sheet's 1.9 km.

## What is not verified

- Nobody has walked these routes. Gates are read from imagery.
- Station entrances are not in the data, so a walk can end some 10 to 30 m from the actual stairs or a different
  entrance. Elevated stations typically have entrances on both sides of the road: a crossing can be added to
  the walk.
- Crossings: the street data has no pedestrian crossings, medians or fences, so busy roads (Amaltash Marg,
  Captain Vijyant Thapar Marg) are treated as crossable anywhere there is a junction. The independent router makes the same
  assumption, which is why the two agree.

## Files

- `jindalx/world-routes.json`: the new walks (routes from the gate, two stations per option).
- `scripts/world/routes.py`: gate origins (`--origins`), underpass rule (`--no-walk`), snapping to streets, walk-ranked stations, per-gate report (`--report`).
- To regenerate, per region (`west`, `67`):
  `.w3d/bin/python scripts/world/routes.py DATA scripts/world/regions/noida-jindalx-<region>.json OUT.json --origins GATES.json --no-walk Underpass:30`
  where `GATES.json` is `{ "<option id>": [[lng, lat], ...] }`, converted from the site files' gates with
  dy/110950 and dx/(111320 cos lat) from each scene origin; then merge the two outputs into `jindalx/world-routes.json`.
