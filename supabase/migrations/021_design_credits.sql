-- Additive, private application credits. These are NOT Higgsfield billing credits.
begin;
create table if not exists atlas_design_credit_wallets (
 project text not null references atlas_links(slug),owner_id text not null,
 balance integer not null default 0 check(balance>=0),reserved integer not null default 0 check(reserved>=0 and reserved<=balance),
 primary key(project,owner_id)
);
create table if not exists atlas_design_credit_grants (
 grant_id text primary key, project text not null,owner_id text not null,units integer not null check(units=1),
 context jsonb not null,created_at timestamptz not null default now(),
 foreign key(project,owner_id) references atlas_design_credit_wallets(project,owner_id)
);
create table if not exists atlas_design_credit_reservations (
 job_id uuid primary key references atlas_design_jobs(id),project text not null,owner_id text not null,
 grant_id text not null references atlas_design_credit_grants(grant_id),
 status text not null check(status in ('reserved','charged','released')),units integer not null default 1 check(units=1),
 created_at timestamptz not null default now(),settled_at timestamptz,
 foreign key(project,owner_id) references atlas_design_credit_wallets(project,owner_id)
);
create unique index if not exists design_demo_one_live_request on atlas_design_credit_reservations(grant_id) where status in ('reserved','charged');
create table if not exists atlas_design_credit_ledger (
 id bigint generated always as identity primary key,project text not null,owner_id text not null,
 job_id uuid,grant_id text not null,action text not null check(action in ('grant','reserve','charge','release')),
 units integer not null check(units=1),created_at timestamptz not null default now(),unique(job_id,action)
);
alter table atlas_design_jobs drop constraint if exists atlas_design_jobs_status_check;
alter table atlas_design_jobs add constraint atlas_design_jobs_status_check check(status in ('queued','running','reconciling','review_required','accepted','rejected','failed'));
alter table atlas_design_credit_wallets enable row level security;
alter table atlas_design_credit_grants enable row level security;
alter table atlas_design_credit_reservations enable row level security;
alter table atlas_design_credit_ledger enable row level security;
revoke all on atlas_design_credit_wallets,atlas_design_credit_grants,atlas_design_credit_reservations,atlas_design_credit_ledger from anon,authenticated;
grant all on atlas_design_credit_wallets,atlas_design_credit_grants,atlas_design_credit_reservations,atlas_design_credit_ledger to service_role;
grant usage,select on sequence atlas_design_credit_ledger_id_seq to service_role;
create or replace function grant_atlas_design_demo_credit(p_grant_id text,p_project text,p_owner text,p_context jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_context->>'room_type'<>'Meeting room' then raise exception 'Demo grant requires a meeting room';end if;
 insert into atlas_design_credit_wallets(project,owner_id) values(p_project,p_owner) on conflict do nothing;
 perform 1 from atlas_design_credit_wallets where project=p_project and owner_id=p_owner for update;
 if exists(select 1 from atlas_design_credit_grants where grant_id=p_grant_id) then
  if not exists(select 1 from atlas_design_credit_grants where grant_id=p_grant_id and project=p_project and owner_id=p_owner and context=p_context) then raise exception 'Demo grant scope differs';end if;
  return;
 end if;
 insert into atlas_design_credit_grants(grant_id,project,owner_id,units,context) values(p_grant_id,p_project,p_owner,1,p_context);
 update atlas_design_credit_wallets set balance=balance+1 where project=p_project and owner_id=p_owner;
 insert into atlas_design_credit_ledger(project,owner_id,grant_id,action,units) values(p_project,p_owner,p_grant_id,'grant',1);
end $$;
create or replace function reserve_atlas_design_generation(p_job jsonb,p_grant_id text)
returns setof atlas_design_jobs language plpgsql security definer set search_path=public as $$
declare w atlas_design_credit_wallets;g atlas_design_credit_grants;existing atlas_design_jobs;j atlas_design_jobs;
begin
 select * into w from atlas_design_credit_wallets where project=p_job->>'project' and owner_id=p_job->>'owner_id' for update;
 if not found then raise exception 'No demo credit granted';end if;
 select * into existing from atlas_design_jobs where project=p_job->>'project' and owner_id=p_job->>'owner_id' and request_key=p_job->>'request_key';
 if found then return next existing;return;end if;
 select * into g from atlas_design_credit_grants where grant_id=p_grant_id and project=w.project and owner_id=w.owner_id;
 if not found or g.context<>p_job->'specification'->'context' then raise exception 'Generation is outside demo credit scope';end if;
 if w.balance-w.reserved<1 then raise exception 'No available demo credit';end if;
 if exists(select 1 from atlas_design_credit_reservations where grant_id=p_grant_id and status in ('reserved','charged')) then raise exception 'Demo allowance is already in use';end if;
 if p_job->'specification'->>'engine'<>'meeting-visualization' then raise exception 'Unsupported credit operation';end if;
 insert into atlas_design_jobs(id,project,owner_id,event_id,session_id,request_key,status,specification,attempts,created_at)
 values((p_job->>'id')::uuid,w.project,w.owner_id,(p_job->>'event_id')::uuid,(p_job->>'session_id')::uuid,p_job->>'request_key','queued',p_job->'specification',0,now()) returning * into j;
 update atlas_design_credit_wallets set reserved=reserved+1 where project=w.project and owner_id=w.owner_id;
 insert into atlas_design_credit_reservations(job_id,project,owner_id,grant_id,status) values(j.id,w.project,w.owner_id,p_grant_id,'reserved');
 insert into atlas_design_credit_ledger(project,owner_id,job_id,grant_id,action,units) values(w.project,w.owner_id,j.id,p_grant_id,'reserve',1);
 return next j;
end $$;
create or replace function settle_atlas_design_generation(p_job_id uuid,p_worker uuid,p_result jsonb,p_failure text default null)
returns setof atlas_design_jobs language plpgsql security definer set search_path=public as $$
declare j atlas_design_jobs;r atlas_design_credit_reservations;
begin
 select * into j from atlas_design_jobs where id=p_job_id for update;
 if not found then raise exception 'Job not found';end if;
 select * into r from atlas_design_credit_reservations where job_id=j.id for update;
 if not found then raise exception 'Reservation not found';end if;
 if r.status<>'reserved' then return next j;return;end if;
 if j.status<>'running' or j.lease_owner is distinct from p_worker or j.lease_expires_at<now() then raise exception 'Worker lease is stale';end if;
 if p_failure is null then
  if p_result->>'kind'<>'ai-visualization' or coalesce(p_result->>'storage_path','')='' or coalesce(p_result->'checks'->>'image_sha256','')='' then raise exception 'Retained visualization required';end if;
  update atlas_design_credit_wallets set reserved=reserved-1,balance=balance-1 where project=r.project and owner_id=r.owner_id;
  update atlas_design_credit_reservations set status='charged',settled_at=now() where job_id=j.id;
  insert into atlas_design_credit_ledger(project,owner_id,job_id,grant_id,action,units) values(r.project,r.owner_id,j.id,r.grant_id,'charge',1);
  update atlas_design_jobs set status='review_required',result=p_result,error=null,completed_at=now(),lease_owner=null,lease_expires_at=null where id=j.id returning * into j;
 else
  update atlas_design_credit_wallets set reserved=reserved-1 where project=r.project and owner_id=r.owner_id;
  update atlas_design_credit_reservations set status='released',settled_at=now() where job_id=j.id;
  insert into atlas_design_credit_ledger(project,owner_id,job_id,grant_id,action,units) values(r.project,r.owner_id,j.id,r.grant_id,'release',1);
  update atlas_design_jobs set status='failed',error=left(p_failure,500),completed_at=now(),lease_owner=null,lease_expires_at=null where id=j.id returning * into j;
 end if;
 return next j;
end $$;
revoke all on function grant_atlas_design_demo_credit(text,text,text,jsonb),reserve_atlas_design_generation(jsonb,text),settle_atlas_design_generation(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function grant_atlas_design_demo_credit(text,text,text,jsonb),reserve_atlas_design_generation(jsonb,text),settle_atlas_design_generation(uuid,uuid,jsonb,text) to service_role;
commit;
-- Exhausted paid jobs retain a reservation for reconciliation, never a false refund.
create or replace function claim_atlas_design_job(worker_id uuid,lease_seconds integer default 300)
returns setof atlas_design_jobs language plpgsql security definer set search_path=public as $$
begin
 update atlas_design_jobs set status=case when specification->>'engine'='meeting-visualization' then 'reconciling' else 'failed' end,
 error='Worker retry limit reached; paid reservations require reconciliation.'
 where status='running' and lease_expires_at<now() and attempts>=3;
 return query with picked as (
  select id from atlas_design_jobs where attempts<3 and (status='queued' or (status='running' and lease_expires_at<now())) order by created_at for update skip locked limit 1
 ) update atlas_design_jobs j set status='running',lease_owner=worker_id,lease_expires_at=now()+make_interval(secs=>least(greatest(lease_seconds,30),900)),attempts=j.attempts+1,started_at=now() from picked where j.id=picked.id returning j.*;
end $$;
revoke all on function claim_atlas_design_job(uuid,integer) from public,anon,authenticated;
grant execute on function claim_atlas_design_job(uuid,integer) to service_role;
