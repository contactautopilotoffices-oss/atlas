-- Server and dedicated worker only. Does not change existing Atlas content.
begin;
alter table atlas_design_jobs add column if not exists request_key text;
alter table atlas_design_jobs add column if not exists session_id uuid;
alter table atlas_design_jobs add column if not exists lease_owner uuid;
alter table atlas_design_jobs add column if not exists lease_expires_at timestamptz;
alter table atlas_design_jobs add column if not exists attempts integer not null default 0;
alter table atlas_design_jobs add column if not exists started_at timestamptz;
alter table atlas_design_jobs add column if not exists completed_at timestamptz;
alter table atlas_design_jobs add column if not exists error text;
alter table atlas_design_jobs add column if not exists provider_state jsonb;
create unique index if not exists design_job_request on atlas_design_jobs(project,owner_id,request_key);
create table if not exists atlas_design_workers(id uuid primary key,last_seen_at timestamptz not null,capabilities text[] not null);
alter table atlas_design_workers enable row level security;
revoke all on atlas_design_workers from anon,authenticated;
grant all on atlas_design_workers to service_role;
update storage.buckets set public=false where id='atlas-design-private';
create or replace function claim_atlas_design_job(worker_id uuid,lease_seconds integer default 300)
returns setof atlas_design_jobs language plpgsql security definer set search_path=public as $$
begin
 update atlas_design_jobs set status='failed',error='Worker retry limit reached.' where status='running' and lease_expires_at<now() and attempts>=3;
 return query with picked as (
  select id from atlas_design_jobs where attempts<3 and
   (status='queued' or (status='running' and lease_expires_at<now()))
  order by created_at for update skip locked limit 1
 ) update atlas_design_jobs j set status='running',lease_owner=worker_id,
  lease_expires_at=now()+make_interval(secs=>least(greatest(lease_seconds,30),900)),
  attempts=j.attempts+1,started_at=now()
 from picked where j.id=picked.id returning j.*;
end $$;
revoke all on function claim_atlas_design_job(uuid,integer) from public,anon,authenticated;
grant execute on function claim_atlas_design_job(uuid,integer) to service_role;
commit;
