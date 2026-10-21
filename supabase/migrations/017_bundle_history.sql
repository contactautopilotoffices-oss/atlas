-- ATLAS 017: every publish of a workbook atlas is kept as a numbered version.
--
-- Publish is the source of truth. atlas_bundles holds what is live; this
-- table holds every version that was ever live, so the team can see v1, v2,
-- v3 in /admin/ and make an earlier one live again (which goes out as a new
-- number, so the history stays a straight line). A visitor never sees a
-- version: /<link id> simply shows what is live.
--
-- Also: a workbook atlas is now served at /<link id> rather than
-- /engine/?atlas=<link id>; the old address still works. Links saved before
-- this migration carry path "/" and are corrected here. Safe to run more
-- than once.
begin;

create table if not exists atlas_bundle_history (
  id          uuid primary key default gen_random_uuid(),
  link_slug   text not null references atlas_links(slug) on delete cascade,
  version     integer not null,
  bundle      jsonb not null,
  action      text not null check (action in ('publish','rollback')),
  by_email    text,
  note        text,
  at          timestamptz not null default now()
);
create index if not exists idx_bundle_history on atlas_bundle_history(link_slug, at desc);
alter table atlas_bundle_history enable row level security;

update atlas_links set path = '/' || slug where kind = 'bundle' and (path is null or path = '/');

commit;
