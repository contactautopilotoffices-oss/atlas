-- ATLAS 012 — public storage bucket for property video.
-- The 17 site videos are correctly gitignored (87 MB) but were still referenced in
-- data/media-manifest.json, so every one of them 404s on the deployed site. They need
-- to live in object storage, not the repo.
begin;

insert into storage.buckets (id, name, public, file_size_limit)
values ('property-media', 'property-media', true, 52428800)
on conflict (id) do update
  set public = true, file_size_limit = 52428800;

-- public read; writes stay with service_role, same posture as the data tables
drop policy if exists "property_media_public_read" on storage.objects;
create policy "property_media_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'property-media');

commit;
