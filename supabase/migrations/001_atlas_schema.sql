-- ATLAS — property intelligence schema
-- Run in Supabase dashboard → SQL Editor → New query → Run.
-- Design rule: this schema ENFORCES the truth contract. Provenance columns are NOT NULL
-- where a claim reaches the screen, so an unsourced row cannot be inserted by accident.

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- properties
-- ─────────────────────────────────────────────────────────────
create table if not exists properties (
  id              text primary key,              -- matches data.js bldg ids: itpl, primeco…
  client_slug     text not null,
  name            text not null,
  locality        text,
  lat             double precision,
  lng             double precision,
  coord_confirmed boolean not null default false,-- false = locality centroid fallback, label it
  coord_source    text,
  cost_per_seat   integer,
  floors_total    text,
  floor_offered   text,
  condition       text,
  grade           text,
  kia_km          numeric,
  kia_drive_min   integer,
  sort_hint       integer,
  created_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- media — photos and video, provenance mandatory
-- ─────────────────────────────────────────────────────────────
create table if not exists property_media (
  id            uuid primary key default gen_random_uuid(),
  property_id   text not null references properties(id) on delete cascade,
  kind          text not null check (kind in ('photo','video')),
  storage_path  text not null,
  width         integer,
  height        integer,
  orientation   text check (orientation in ('landscape','portrait','square')),
  sort_order    integer not null default 0,

  -- AI-enhancement provenance. An enhanced asset MUST point at the original it came
  -- from, so the UI can always show what was actually photographed.
  is_enhanced       boolean not null default false,
  enhancement_model text,
  original_media_id uuid references property_media(id) on delete set null,

  caption      text,
  source       text not null,                    -- who supplied it
  source_url   text,
  license      text,
  captured_at  date,
  confidence   text not null default 'unconfirmed' check (confidence in ('verified','unconfirmed')),
  confirmations text[] not null default '{}',    -- needs >=2 entries to be 'verified'
  created_at   timestamptz not null default now(),

  constraint enhanced_needs_original
    check (not is_enhanced or original_media_id is not null),
  constraint verified_needs_two_confirmations
    check (confidence <> 'verified' or array_length(confirmations,1) >= 2)
);
create index if not exists idx_media_property on property_media(property_id, sort_order);

-- ─────────────────────────────────────────────────────────────
-- metro stations
-- ─────────────────────────────────────────────────────────────
create table if not exists metro_stations (
  id         text primary key,
  line       text not null,
  name_en    text not null,
  name_kn    text,
  lat        double precision not null,
  lng        double precision not null,
  source     text not null,
  source_url text,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- property → station distances. method records HOW it was derived.
-- ─────────────────────────────────────────────────────────────
create table if not exists property_station_links (
  id          uuid primary key default gen_random_uuid(),
  property_id text not null references properties(id) on delete cascade,
  station_id  text not null references metro_stations(id) on delete cascade,
  is_nearest  boolean not null default false,
  walk_m      integer,
  walk_min    integer,
  drive_m     integer,
  drive_min   integer,
  route_geojson jsonb,
  method      text not null check (method in ('osrm','mappls','geodesic','client-stated')),
  source_url  text,
  computed_at timestamptz not null default now(),
  unique (property_id, station_id)
);

-- ─────────────────────────────────────────────────────────────
-- competitors — VFX/post studios near a property. Citation mandatory.
-- ─────────────────────────────────────────────────────────────
create table if not exists property_competitors (
  id          uuid primary key default gen_random_uuid(),
  property_id text not null references properties(id) on delete cascade,
  name        text not null,
  category    text,
  lat         double precision,
  lng         double precision,
  distance_m  integer,
  logo_path   text,
  source_url  text not null,                     -- no citation, no row
  source_name text not null,
  confidence  text not null default 'unconfirmed' check (confidence in ('verified','unconfirmed')),
  created_at  timestamptz not null default now()
);
create index if not exists idx_comp_property on property_competitors(property_id, distance_m);

-- ─────────────────────────────────────────────────────────────
-- evidence ledger mirror of evidence/ledger.jsonl
-- ─────────────────────────────────────────────────────────────
create table if not exists evidence_ledger (
  id         text primary key,
  claim      text not null,
  value      text,
  source     text not null,
  source_url text,
  method     text check (method in ('api','document','photograph','site-visit','client-stated')),
  confidence text check (confidence in ('verified','unconfirmed','derived')),
  fetched_at timestamptz,
  notes      text
);

-- ─────────────────────────────────────────────────────────────
-- RLS: the anon key ships in the browser, so the database must assume
-- the whole internet holds it. Public read only; every write is service_role.
-- ─────────────────────────────────────────────────────────────
alter table properties             enable row level security;
alter table property_media         enable row level security;
alter table metro_stations         enable row level security;
alter table property_station_links enable row level security;
alter table property_competitors   enable row level security;
alter table evidence_ledger        enable row level security;

do $$
declare t text;
begin
  foreach t in array array['properties','property_media','metro_stations',
                           'property_station_links','property_competitors','evidence_ledger']
  loop
    execute format('drop policy if exists %I on %I', t||'_anon_read', t);
    execute format('create policy %I on %I for select to anon using (true)', t||'_anon_read', t);
  end loop;
end $$;
