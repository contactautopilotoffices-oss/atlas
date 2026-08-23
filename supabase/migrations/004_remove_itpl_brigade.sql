-- ATLAS 004 — shortlist reduced to 6: ITPL, Brigade Utopia and Verman removed.
-- Verman never existed as a property record (deck had no entry for it).
-- Re-runnable. Run AFTER 003_seed_v2.sql.
begin;

-- cascade clears media/links/competitors for the dropped properties
-- The method check in 001 predates the switch to Mapbox Directions: it allowed only
-- ('osrm','mappls','geodesic','client-stated'). The constraint correctly rejected the
-- new 'mapbox-directions' value, so widen it here before re-seeding the links.
alter table property_station_links drop constraint if exists property_station_links_method_check;
alter table property_station_links add constraint property_station_links_method_check
  check (method in ('osrm','mappls','geodesic','client-stated','mapbox-directions'));

delete from properties where id in ('itpl','brigade');
delete from property_competitors;

insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('primeco','pattandur-agrahara',true,692,9,1025,5,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking') on conflict (property_id,station_id) do update set walk_m=excluded.walk_m,walk_min=excluded.walk_min,drive_m=excluded.drive_m,drive_min=excluded.drive_min,method=excluded.method;
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('sumadhura','kadugodi-tree-park',true,538,7,744,4,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking') on conflict (property_id,station_id) do update set walk_m=excluded.walk_m,walk_min=excluded.walk_min,drive_m=excluded.drive_m,drive_min=excluded.drive_min,method=excluded.method;
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('starmark','sri-sathya-sai-hospital',true,723,10,962,3,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking') on conflict (property_id,station_id) do update set walk_m=excluded.walk_m,walk_min=excluded.walk_min,drive_m=excluded.drive_m,drive_min=excluded.drive_min,method=excluded.method;
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('totalenv','singayyanapalya',true,1045,13,1395,5,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking') on conflict (property_id,station_id) do update set walk_m=excluded.walk_m,walk_min=excluded.walk_min,drive_m=excluded.drive_m,drive_min=excluded.drive_min,method=excluded.method;
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('yliving','kadugodi-tree-park',true,2213,27,2223,8,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking') on conflict (property_id,station_id) do update set walk_m=excluded.walk_m,walk_min=excluded.walk_min,drive_m=excluded.drive_m,drive_min=excluded.drive_min,method=excluded.method;
insert into property_station_links (property_id,station_id,is_nearest,walk_m,walk_min,drive_m,drive_min,method,source_url) values ('purva','beratena-agrahara',true,1425,17,2809,8,'mapbox-directions','https://api.mapbox.com/directions/v5/mapbox/walking') on conflict (property_id,station_id) do update set walk_m=excluded.walk_m,walk_min=excluded.walk_min,drive_m=excluded.drive_m,drive_min=excluded.drive_min,method=excluded.method;
insert into property_competitors (property_id,name,category,lat,lng,distance_m,source_url,source_name,confidence) values ('primeco','88 Pictures','Animation / VFX / games',12.9889029,77.7310416,173,'https://88.pictures/bangalore/','88 Pictures official site','unconfirmed');
insert into property_competitors (property_id,name,category,lat,lng,distance_m,source_url,source_name,confidence) values ('primeco','DNEG','VFX — feature film',12.9857365,77.7346869,432,'https://www.dneg.com/location/bengaluru','DNEG official site','verified');
insert into property_competitors (property_id,name,category,lat,lng,distance_m,source_url,source_name,confidence) values ('primeco','DeMeg Studios','3D animation / VFX',12.9922533,77.7361863,525,'https://www.demegstudios.com/','DeMeg Studios official site','unconfirmed');
insert into property_competitors (property_id,name,category,lat,lng,distance_m,source_url,source_name,confidence) values ('primeco','Astra Studios','VFX / animation / virtual production',12.9863725,77.739803,833,'https://theastrastudios.com/studio','Astra Studios official site','verified');
insert into property_competitors (property_id,name,category,lat,lng,distance_m,source_url,source_name,confidence) values ('starmark','88 Pictures','Animation / VFX / games',12.9889029,77.7310416,643,'https://88.pictures/bangalore/','88 Pictures official site','unconfirmed');
insert into property_competitors (property_id,name,category,lat,lng,distance_m,source_url,source_name,confidence) values ('starmark','DNEG','VFX — feature film',12.9857365,77.7346869,871,'https://www.dneg.com/location/bengaluru','DNEG official site','verified');

commit;
