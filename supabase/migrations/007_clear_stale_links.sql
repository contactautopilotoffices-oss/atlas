-- ATLAS 007 — clear stale station links.
-- The unique key is (property_id, station_id), so `on conflict do update` inserts a
-- NEW row whenever a property's nearest station changes and leaves the old one behind.
-- totalenv and yliving each ended up with two 'nearest' rows after their relocations.
-- Correct pattern for a derived table: clear, then insert.
begin;

delete from property_station_links;

insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('primeco','pattandur-agrahara',true,692,9,1025,5,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('sumadhura','kadugodi-tree-park',true,538,7,744,4,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('starmark','sri-sathya-sai-hospital',true,723,10,962,3,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('totalenv','pattandur-agrahara',true,831,10,810,5,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('yliving','seetharampalya',true,577,8,1149,4,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('purva','beratena-agrahara',true,1425,17,2809,8,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking');

commit;
