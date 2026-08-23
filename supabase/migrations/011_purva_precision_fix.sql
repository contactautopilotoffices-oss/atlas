-- ATLAS 011 — correct Purva Gainz precision.
-- 010 backfilled every existing row to 'footprint', but Purva has no OSM polygon:
-- its coordinate is a Google Maps NAMED PLACE pin ("Purva Gainz"). That is the same
-- class of evidence as Y Living's — a verified point without a surveyed footprint.
begin;
update properties
   set coord_precision = 'project',
       coord_source = 'Google Maps named place pin (Purva Gainz) — no OSM footprint'
 where id = 'purva';
commit;
