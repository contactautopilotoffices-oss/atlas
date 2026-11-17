---
name: archviz-location-mapping
description: How to build the aerial "where is it" sequence for a property, learned from the reference video "Camera Movement and Location Mapping": a city-scale aerial with real terrain and coast, points of interest pinned with distance and drive time, a glowing route from the site, the site outlined, and a fly-down from the city to the project's amenities at street level, with time of day and cloud controls. Use when making a location or connectivity map, a context flythrough, the opening of a property film, or the map mode of the 3D explorer.
---

# Location mapping

Read `archviz-quality-bar` first.

## What the reference does (Tal El Nakheel, Dammam; Vancore)

1. **The opening shot** is a high oblique aerial (about 40 degrees down, 2 to
   4 km out) over the whole city to the coast, in haze. The project name sits
   in thin caps, bottom left.
2. **POI pins** float over landmarks (university, expo, stadium, medical
   centre). Each is a white pill with an icon and the name, with a small dark
   chip under it giving the distance and the drive time ("4.1 km · 8 min").
   They are anchored in 3D, scale slightly with distance, and never overlap.
3. **The route** from the site to the chosen POI is drawn on the actual
   roads as a soft red-pink glowing line (additive, about 6 to 10 m wide at
   city scale, with a brighter core). The site plot is outlined in yellow.
4. **The fly-down:** one continuous camera move, with no cut, from the city
   aerial into the community and down to the amenity (padel court, kids'
   area, villa frontage) at street or drone height. Motion blur sells the
   speed. The camera eases in, accelerates through the middle and eases out.
5. **The UI** has a breadcrumb at top left (Main View > Explore > Kids
   Area), a bottom dock (Map, Explore, Amenities, Units, Gallery, Close), and
   a time-of-day plus cloud-coverage card at bottom right (Noon, Dusk, Night;
   Clear, Partly, Cloudy). The last shot is the same aerial at night with the
   city lit.

## How we build it

**Context model**
- Use real footprints (Overture), real heights where known, and real terrain
  (Copernicus or SRTM DEM as a displaced plane) with water bodies and coast.
- Apply an aerial or satellite texture on the ground where licensing allows.
  If not, use a procedural ground (soil, grass and paving by land use) with
  road surfaces that carry markings.
- Extend the city to the horizon with low-detail blocks and fade it into
  haze, so it never ends at an edge.
- Volumetric or depth haze is mandatory at this scale. In Cycles use a world
  volume (density 0.0003 to 0.001) or a mist pass composited. On the web,
  use exponential fog tied to camera distance.

**POIs and routes**
- POI data needs a name, a category icon, a lat/lng, and the distance and
  time from the site. These are measured (Google Maps or Mappls) and stored
  with their source. Never estimate them.
- Draw the route as a ribbon along the routed road geometry (OSRM, Mappls or
  Google), lifted 1 to 2 m, additive, with a bright core and a soft outer
  glow. In stills, render it as an emissive curve with bevel. Animate a
  travelling dash for direction.
- Outline the site with an emissive polyline on the plot boundary and a
  faint fill.

**The fly-down (Blender)**
- Camera on a Bezier path with "Follow Path". Ease the evaluation time with
  an F-curve (ease in, ease out). Track to an Empty that leads the camera.
- Keep the camera 30 to 60 m above roofs during the fast part. Drop to 8 to
  20 m only for the final reveal.
- Motion blur on (shutter 0.5). Depth of field only in the last 2 seconds.
- Shot length is 6 to 10 s per fly-down at 24 or 30 fps.

**Time of day and clouds**
- Use the sun from real solar position for the site's latitude and date, and
  a Nishita or multiple-scattering sky. Clouds are a cloud layer (HDRI with
  clouds, or a volumetric shell) whose coverage is a slider. See
  `archviz-lighting-day-night`.

## Checklist

- [ ] The aerial reads as the real city: terrain, coast or water, road
  hierarchy, texture variation, haze.
- [ ] Every POI shows measured distance and time, and the source is recorded.
- [ ] The route follows real roads, never a straight line.
- [ ] The site is outlined. The camera move is continuous, eased and
  motion-blurred.
- [ ] Night variant: street lights, lit windows, car light trails.
