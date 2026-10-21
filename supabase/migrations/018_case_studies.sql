-- ATLAS 018: case studies built from a workbook, and every publish of one.
--
--   atlas_cases          one case bundle per link (casestudy/SCHEMA.md): the
--                        draft being worked on and the version that is live
--   atlas_case_history   every publish, numbered, so the team can see v1, v2
--                        and make an earlier one live again. The reader
--                        never sees a version: /<link id>/case is what is live.
--
-- A link may now be a case study on its own (kind 'case', path
-- /<id>/case) or carry one beside its atlas. Server-only, as everything in
-- 013 is: row level security on, no policy for anon. Safe to run more than
-- once.
begin;

alter table atlas_links drop constraint if exists atlas_links_kind_check;
alter table atlas_links add constraint atlas_links_kind_check check (kind in ('client','study','tool','bundle','case'));

create table if not exists atlas_cases (
  link_slug         text primary key references atlas_links(slug) on delete cascade,
  draft             jsonb,
  published         jsonb,
  draft_updated_at  timestamptz,
  draft_updated_by  text,
  published_at      timestamptz,
  published_by      text,
  version           integer not null default 0
);
alter table atlas_cases enable row level security;

create table if not exists atlas_case_history (
  id          uuid primary key default gen_random_uuid(),
  link_slug   text not null references atlas_links(slug) on delete cascade,
  version     integer not null,
  bundle      jsonb not null,
  action      text not null check (action in ('publish','rollback')),
  by_email    text,
  note        text,
  at          timestamptz not null default now()
);
create index if not exists idx_case_history on atlas_case_history(link_slug, at desc);
alter table atlas_case_history enable row level security;

commit;
