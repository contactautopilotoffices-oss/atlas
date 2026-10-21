-- ATLAS 016: atlases built from a workbook, and the credentials that open them.
--
-- Until now every Atlas was committed code: a folder with its own data.js, a
-- credential typed into clients/manifest.js, and a deploy. This is what lets
-- the team make one from /admin/ with no code at all.
--
--   atlas_bundles   one bundle per link (engine/SCHEMA.md): the draft being
--                   worked on and the version that is live, exactly as
--                   atlas_overrides does for the committed studies.
--   atlas_access    the access IDs that open a bundle atlas, with a scrypt
--                   hash of the password. Checked by the server, never by the
--                   browser, which is the first credential on this site that
--                   does not ship to every visitor in a script.
--
-- Server-only, as everything in 013 is: row level security on, no policy for
-- anon. Safe to run more than once.
begin;

-- A link may now be an atlas built from a workbook.
alter table atlas_links drop constraint if exists atlas_links_kind_check;
alter table atlas_links add constraint atlas_links_kind_check check (kind in ('client','study','tool','bundle'));

create table if not exists atlas_bundles (
  link_slug         text primary key references atlas_links(slug) on delete cascade,
  draft             jsonb,
  published         jsonb,
  draft_updated_at  timestamptz,
  draft_updated_by  text,
  published_at      timestamptz,
  published_by      text,
  version           integer not null default 0
);
alter table atlas_bundles enable row level security;

create table if not exists atlas_access (
  access_id      text primary key,                  -- what the visitor types, upper case
  link_slug      text not null references atlas_links(slug) on delete cascade,
  password_hash  text not null,
  name           text,                              -- who it was issued to
  active         boolean not null default true,
  failed_logins  integer not null default 0,
  locked_until   timestamptz,
  last_used_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_access_link on atlas_access(link_slug);
alter table atlas_access enable row level security;

commit;
