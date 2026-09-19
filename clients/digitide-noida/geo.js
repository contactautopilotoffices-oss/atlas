/* DIGITIDE NOIDA — building footprints.
   EMPTY BY DESIGN. None of the five options matched a named OSM polygon: the
   Overpass and Nominatim endpoints used for the other clients' footprint passes
   are blocked by this environment's egress policy, so no footprint could be
   fetched or verified for any plot in Sector 57/58/60/62/67.
   Every building therefore renders as an explicit fallback box at the
   coordinate precision declared per option in data.js — plot-approx or sector.
   Fill this in when a footprint pass can run; do not hand-draw polygons. */
window.BKC_GEOJSON = { "type": "FeatureCollection", "features": [] };
