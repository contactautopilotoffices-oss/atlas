-- Reusable design service. Server authorization is mandatory; no browser policies.
begin;
create table if not exists atlas_design_references (
 id text primary key,
 record jsonb not null,
 room_type text not null,
 offering_tier text not null,
 review_status text not null check (review_status in ('pending','reviewed','rejected')),
 allowed_projects text[] not null default '{}',
 shared_library_approved boolean not null default false
);
create index if not exists design_reference_scope on atlas_design_references(room_type,offering_tier,review_status);
create table if not exists atlas_design_events (
 id uuid primary key,
 project text not null references atlas_links(slug),
 owner_id text not null,
 session_id uuid not null,
 revision integer not null check(revision>0),
 parent_event_id uuid references atlas_design_events(id),
 state jsonb not null,
 created_at timestamptz not null default now(),
 unique(project,owner_id,session_id,revision)
);
create index if not exists design_session_owner on atlas_design_events(project,owner_id,session_id,revision desc);
create table if not exists atlas_design_jobs (
 id uuid primary key,
 project text not null references atlas_links(slug),
 owner_id text not null,
 event_id uuid not null references atlas_design_events(id),
 status text not null check(status in ('queued','running','review_required','accepted','rejected','failed')),
 specification jsonb not null,
 result jsonb,
 created_at timestamptz not null default now()
);
alter table atlas_design_references enable row level security;
alter table atlas_design_events enable row level security;
alter table atlas_design_jobs enable row level security;
revoke all on atlas_design_references,atlas_design_events,atlas_design_jobs from anon,authenticated;
grant all on atlas_design_references,atlas_design_events,atlas_design_jobs to service_role;
-- Private objects, unlike the existing public CMS media bucket. No anonymous policies.
insert into storage.buckets(id,name,public) values ('atlas-design-private','atlas-design-private',false) on conflict(id) do nothing;
commit;
