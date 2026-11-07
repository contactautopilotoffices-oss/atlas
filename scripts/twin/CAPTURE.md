# Photographing a building for its digital twin

What to shoot so `scripts/twin` can rebuild a building's exterior from
photos. A phone is fine. The first building is Skymark F-1, Sector 6,
Noida.

## The one rule

**Every photo must share most of what it shows with the photo before it**
(about 70% overlap). Reconstruction works by finding the same corners, joints
and marks in several photos, so a jump is a gap in the model.

## How

- **Walk, don't zoom.** Take a step of about 2 to 3 m sideways between shots and
  keep the zoom fixed (1x on a phone; no portrait mode, no ultra wide).
- **Light.** Shoot in one session, ideally with an overcast sky or the sun
  behind you. Avoid low sun straight into the lens.
- **Phone settings.** Keep location on, so GPS goes into the photos. That gives
  the model a position on the map.
- **Keep it sharp.** Hold still for each shot. Blurred photos are flagged and
  ignored.
- **Moving things are fine** (cars, people), but don't let one fill the frame.
- **Glass is hard** for every method. Shoot glass facades at an angle (30 to
  60 degrees off straight-on), and include their frames and the solid parts.
- **Measure one dimension** if you can, with a tape or a laser: a door width,
  a column, a bay of the facade. This turns the model from "the right shape"
  into "the right size". Write it down with a photo of where you measured.

## The shot list

| Where | Photos | How |
| --- | --- | --- |
| Each elevation (front, both sides, rear) | 8 to 12 each | Walk along it at a distance where the whole height fits, one shot every 2 to 3 m, square on |
| Each corner | 3 to 5 each | An arc round the corner, so neighbouring elevations link up |
| Close details | 10 to 15 | Entrance and canopy, a facade bay, cladding joints, a window frame, signage |
| From further back | 5 to 10 | Across the road, showing the building with its neighbours |
| Roof (if a terrace or drone is possible) | 5 to 10 | Optional; otherwise the roof stays "estimated" |
| Inside, for a fit-out (optional) | 20 to 40 per space | The same walking rule, at chest height, plus some looking up and down |

That's about 50 to 80 photos for an exterior. More is fine: the ingest step
flags duplicates and blur.

## Video works too

A slow, steady 4K video walk round the building (1 to 2 min per side) can be
used instead: the pipeline takes 2 frames a second from it. Photos are still
sharper.

## What you will get

- A structured model: storeys, facade grid, entrance and roof. Each element
  is marked measured, documented, reconstructed, estimated or unknown, with
  the photos it came from.
- A photoreal scan of the same building (a Gaussian splat) for clients to
  look round. This needs a GPU, so it runs on a GPU machine, not in this
  repo's cloud session.
- Renders from the same camera as your photos, side by side, so anyone can
  see where the model is right and where it isn't.
