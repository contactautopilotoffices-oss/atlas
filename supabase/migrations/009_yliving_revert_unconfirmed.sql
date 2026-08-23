-- ATLAS 009 — revert Y Living to unconfirmed.
-- 008 upgraded it on a zoom-17 reverse-geocode returning "Graphite India Road".
-- At zoom 18 the same point resolves to "Aforserve, Kundalahalli Main Road" and the
-- listing address ("Jn of Graphite India, Ashraya Layout") does not geocode at all.
-- Road-level agreement is not building-level confirmation.
begin;
update properties
   set coord_confirmed = false,
       coord_source = 'RERA-linked point — on Graphite India Road, but exact building position unconfirmed'
 where id = 'yliving';
commit;
