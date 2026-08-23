-- ATLAS 010 — Y Living: registry-verified project coordinate.
-- RERA PRM/KA/RERA/1251/446/PR/130722/005066 (Mixed Development, 19 commercial-office
-- units recorded) plus a named Y@Whitefield map listing exposing 12.9854982, 77.707817.
-- Adds coord_precision so 'verified project pin' is distinguishable from 'surveyed
-- footprint' — a binary confirmed/unconfirmed flag could not express the difference.
begin;

alter table properties add column if not exists coord_precision text
  check (coord_precision in ('footprint','project','locality'));

update properties set coord_precision='footprint' where coord_precision is null;

update properties
   set lat=12.9854982, lng=77.707817, coord_confirmed=true, coord_precision='project',
       coord_source='RERA PRM/KA/RERA/1251/446/PR/130722/005066 + named Y@Whitefield map listing'
 where id='yliving';

delete from property_station_links;

insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('primeco','pattandur-agrahara',true,692,9,1025,5,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('sumadhura','kadugodi-tree-park',true,538,7,744,4,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('starmark','sri-sathya-sai-hospital',true,723,10,962,3,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('totalenv','pattandur-agrahara',true,831,10,810,5,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('yliving','seetharampalya',true,585,8,1156,4,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('purva','beratena-agrahara',true,1425,17,2809,8,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');

commit;
