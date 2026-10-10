-- ATLAS 013: content management, users, broker links and visit analytics.
--
-- Run in Supabase: SQL Editor > New query > paste > Run. Re-runnable.
--
-- Everything here is SERVER-ONLY. Row level security is switched on with no
-- policy for anon, so the browser key that ships in config.js can read or write
-- none of it. The admin API (/api/cms) talks to these tables with the
-- service_role key, which lives only in Vercel's environment variables.

begin;

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- people who can sign in to /admin/
-- role: owner (everything, including other owners), admin (everything but
-- owners), editor (content and brokers, no team or links), viewer (read only).
-- links: null = every Atlas link; otherwise only the listed link slugs.
-- ─────────────────────────────────────────────────────────────
create table if not exists cms_users (
  id              uuid primary key default gen_random_uuid(),
  email           text not null unique,
  name            text not null default '',
  role            text not null check (role in ('owner','admin','editor','viewer')),
  password_hash   text not null,
  links           text[],
  active          boolean not null default true,
  token_version   integer not null default 1,      -- bump to sign a user out everywhere
  failed_logins   integer not null default 0,
  locked_until    timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- every Atlas link that has been shipped
-- kind: client (a client view on the root ATLAS map), study (a standalone
-- study app such as /indore/), tool (internal tools such as /godseye/)
-- status: live, or paused (the link shows a paused notice instead of data)
-- ─────────────────────────────────────────────────────────────
create table if not exists atlas_links (
  slug        text primary key,
  name        text not null,
  kind        text not null check (kind in ('client','study','tool')),
  path        text not null,                 -- where it lives on the site
  access_id   text,                          -- the ID people type at the gate
  city        text,
  status      text not null default 'live' check (status in ('live','paused')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- content overrides per link. draft is what editors work on; published is
-- what the live link reads. The built-in data in each link's data.js stays
-- the base: an override only changes what it names.
-- ─────────────────────────────────────────────────────────────
create table if not exists atlas_overrides (
  link_slug     text primary key references atlas_links(slug) on delete cascade,
  draft         jsonb not null default '{}'::jsonb,
  published     jsonb not null default '{}'::jsonb,
  draft_updated_at timestamptz,
  draft_updated_by text,
  published_at  timestamptz,
  published_by  text,
  version       integer not null default 0
);

create table if not exists atlas_override_history (
  id          uuid primary key default gen_random_uuid(),
  link_slug   text not null references atlas_links(slug) on delete cascade,
  version     integer not null,
  doc         jsonb not null,
  action      text not null check (action in ('publish','rollback')),
  by_email    text,
  note        text,
  at          timestamptz not null default now()
);
create index if not exists idx_override_history on atlas_override_history(link_slug, at desc);

-- ─────────────────────────────────────────────────────────────
-- broker links: a private link a broker opens to send updates on the
-- properties they know. Only a SHA-256 of the token is stored; the link is
-- shown once, when it is created.
-- ─────────────────────────────────────────────────────────────
create table if not exists broker_links (
  id            uuid primary key default gen_random_uuid(),
  token_hash    text not null unique,
  name          text not null,
  firm          text,
  email         text,
  phone         text,
  links         text[] not null default '{}',  -- link slugs they may update
  properties    text[],                        -- null = every property on those links
  can_propose   boolean not null default true, -- may propose properties not on the list
  active        boolean not null default true,
  expires_at    timestamptz,
  created_by    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  submissions   integer not null default 0
);

-- what brokers send. Nothing reaches a live link until someone approves it
-- (it then lands in the draft) and publishes the draft.
create table if not exists broker_submissions (
  id            uuid primary key default gen_random_uuid(),
  broker_id     uuid references broker_links(id) on delete set null,
  broker_name   text,
  link_slug     text not null,
  property_id   text,                          -- null for a proposed new property
  kind          text not null check (kind in ('update','new_property')),
  payload       jsonb not null,                -- { fields: {...}, property: {...} }
  note          text,
  source_note   text,                          -- how the broker knows
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note   text,
  reviewed_by   text,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_submissions_status on broker_submissions(status, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- visits. One row per event from the tracking script on each link:
-- view, signin, heartbeat (every 30 s while the tab is in front), open, tab,
-- signout. No IP address is stored; country and city come from Vercel's
-- edge headers, the visitor id is a random id kept in the browser.
-- ─────────────────────────────────────────────────────────────
create table if not exists atlas_events (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  link_slug   text not null,
  event       text not null check (event in ('view','signin','heartbeat','open','tab','signout')),
  visitor_id  text not null,
  session_id  text not null,
  access_id   text,
  path        text,
  ref_host    text,
  country     text,
  city        text,
  device      text,
  meta        jsonb
);
create index if not exists idx_events_ts on atlas_events(ts desc);
create index if not exists idx_events_link_ts on atlas_events(link_slug, ts desc);

-- who changed what, for the audit log
create table if not exists cms_audit (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  by_email    text,
  action      text not null,
  target      text,
  detail      jsonb
);
create index if not exists idx_audit_at on cms_audit(at desc);

-- RLS on, no anon policies: server-only tables.
alter table cms_users              enable row level security;
alter table atlas_links            enable row level security;
alter table atlas_overrides        enable row level security;
alter table atlas_override_history enable row level security;
alter table broker_links           enable row level security;
alter table broker_submissions     enable row level security;
alter table atlas_events           enable row level security;
alter table cms_audit              enable row level security;

-- 3D models and files uploaded from the admin panel. Public read so a link
-- can load a model; uploads go through short-lived signed URLs the admin API
-- issues, so no browser key can write here.
insert into storage.buckets (id, name, public, file_size_limit)
values ('atlas-cms', 'atlas-cms', true, 104857600)
on conflict (id) do update set public = true, file_size_limit = 104857600;

drop policy if exists "atlas_cms_public_read" on storage.objects;
create policy "atlas_cms_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'atlas-cms');

-- ─────────────────────────────────────────────────────────────
-- the links shipped so far
-- ─────────────────────────────────────────────────────────────
insert into atlas_links (slug, name, kind, path, access_id, city) values
  ('flipkart-andheri', 'Flipkart · Andheri',               'client', '/',           'FLIPDEMOACC',  'Mumbai'),
  ('vfs-bkc',          'VFS · BKC',                        'client', '/',           'VFSDEMOACC',   'Mumbai'),
  ('cp-delhi',         'Connaught Place · Delhi',          'client', '/',           'CPDEMOACC',    'Delhi'),
  ('invesco-andheri',  'Invesco · Andheri',                'client', '/',           'INVDEMOACC',   'Mumbai'),
  ('basilic-fly',      'Whitefield · Bengaluru',           'client', '/',           'FLYDEMOACC',   'Bengaluru'),
  ('digitide-noida',   'Digitide · Noida',                 'client', '/',           'DIGDEMOACC',   'Noida'),
  ('digitide',         'Digitide group command centre',    'study',  '/digitide/',  'DIGITIDE-GRP', 'Multi-city'),
  ('indore',           'Indore office study',              'study',  '/indore/',    'INDORE-AP',    'Indore'),
  ('chennai',          'Chennai office study',             'study',  '/chennai/',   'CHENNAI-AP',   'Chennai'),
  ('godseye',          'God''s Eye',                       'tool',   '/godseye/',   null,           null)
on conflict (slug) do nothing;

insert into atlas_overrides (link_slug)
select slug from atlas_links
on conflict (link_slug) do nothing;

commit;
