-- ATLAS 008 — Y Living coordinate upgraded to verified.
-- RERA-linked point corroborated by Cityinfo Services and JLL, which both place
-- Y@Whitefield / Y Residences at the Jn of Graphite India, Garudachar Palya.
begin;
update properties
   set coord_confirmed = true,
       coord_source = 'RERA point + Cityinfo/JLL listings (Jn of Graphite India, Garudachar Palya)'
 where id = 'yliving';
commit;
