-- ATLAS 015: register the two studies that shipped after 013 was written.
--
-- /andheri/ (the competitors atlas) and /whitefield/ (Total Environment) were
-- never in atlas_links, and their pages never loaded atlas-cms.js, so every
-- visit to them was discarded twice over: the pages sent nothing, and
-- api/cms/track.js drops events for a link it does not know.
--
-- The script tags go in with this migration. Without both halves neither
-- study reports anything.
--
-- Content editing is a separate job. atlas-cms.js keeps a hardcoded ADAPTERS
-- table and neither slug has an entry, so these two are tracked from here but
-- not yet editable. Safe to run more than once.
begin;

insert into atlas_links (slug, name, kind, path, access_id, city) values
  ('andheri',    'Andheri competitors atlas',      'study', '/andheri/',    'AP-ANDHERI',    'Mumbai'),
  ('whitefield', 'Whitefield · Total Environment', 'study', '/whitefield/', 'TE-WHITEFIELD', 'Bengaluru')
on conflict (slug) do nothing;

-- Every link needs its overrides row, as 013 does for the ten it seeded.
insert into atlas_overrides (link_slug)
select slug from atlas_links
 where slug in ('andheri', 'whitefield')
on conflict (link_slug) do nothing;

commit;
