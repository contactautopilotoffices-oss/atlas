/* DIGITIDE NOIDA — building footprints.
   One real OSM polygon: Knowledge Boulevard (way 634075406, the named commercial
   landuse for Plot A-8A, Sector 62), fetched from Nominatim. The engine renders
   it as a true footprint rather than a fallback box.
   The other four options have no OSM polygon — Noida's industrial plots in
   Sectors 57/60/67 are not mapped at building level — so they render as boxes at
   the coordinates declared in data.js. Do not hand-draw polygons for them; add
   them here when a real survey or an OSM trace exists. */
window.BKC_GEOJSON = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Knowledge Boulevard",
        "src": "osm way/634075406 (named commercial landuse, Sector 62) — ledger geo-kboulevard"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [77.367515, 28.6289787],
          [77.3683331, 28.6289763],
          [77.3683841, 28.6312529],
          [77.3675552, 28.6312647],
          [77.367515, 28.6289787]
        ]]
      }
    }
  ]
};
