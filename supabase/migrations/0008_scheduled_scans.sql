-- Scans agendados (PROJECT_SPEC § 2 "Jobs/filas: Supabase pg_cron + tabela
-- scan_jobs com locking por FOR UPDATE SKIP LOCKED. Não introduzas Redis
-- nem BullMQ" e § 6.3 "Scan agendado (diário no Pro, semanal no Solo)").
--
-- Dois cron jobs:
--   1. basescope-enqueue-due-scans (SQL puro, de hora a hora): decide que
--      projetos estão em falta e insere em scan_jobs.
--   2. basescope-process-scan-jobs (pg_net, a cada 5min): acorda o worker —
--      chama /api/cron/process-scan-jobs, que reclama UM job com
--      claim_next_scan_job() (FOR UPDATE SKIP LOCKED) e corre o scan a
--      sério (Node, ligação Postgres direta — impossível em plpgsql puro).
--
-- app.settings.cron_target_url e app.settings.cron_secret NÃO ficam neste
-- ficheiro (segredo não vai para o git) — configurados à parte com
-- `alter database ... set`.

-- pg_cron/pg_net instalam-se sempre nos schemas cron/net por convenção do
-- Supabase — não em `extensions` como pgcrypto/uuid-ossp.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table public.scan_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index scan_jobs_status_idx on public.scan_jobs (status, scheduled_for);

alter table public.scan_jobs enable row level security;
alter table public.scan_jobs force row level security;

-- Só leitura pelo próprio org (para mostrar "próximo scan agendado" na UI).
-- Escrita é sempre via service_role (RPC/cron), nunca do browser.
create policy "scan_jobs_select_own_org"
  on public.scan_jobs for select to authenticated
  using (project_id in (
    select id from public.projects where org_id in (select public.get_my_org_ids())
  ));

-- ─────────────────────────────────────────────────────────────────────────
-- enqueue_due_scans() — decide quem está em falta e cria o job.
-- Solo = semanal, Pro/Agency = diário (secção 8). Reaproveita
-- plan_scan_limit() (0007) para nunca enfileirar acima do teto mensal —
-- evita criar jobs que o executor ia recusar de qualquer forma.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.enqueue_due_scans()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  interval_for_plan interval;
begin
  for r in
    select p.id as project_id, o.plan, o.scans_used_this_period, o.period_ends_at, p.last_scan_at
    from public.projects p
    join public.organizations o on o.id = p.org_id
    where p.connection_status = 'connected'
      and p.ownership_verified_at is not null
      and o.plan in ('solo', 'pro', 'agency')
      and not exists (
        select 1 from public.scan_jobs j
        where j.project_id = p.id and j.status in ('queued', 'running')
      )
  loop
    interval_for_plan := case r.plan when 'solo' then interval '7 days' else interval '1 day' end;

    continue when r.last_scan_at is not null and r.last_scan_at > now() - interval_for_plan;
    continue when r.period_ends_at is not null and r.period_ends_at >= now()
      and r.scans_used_this_period >= public.plan_scan_limit(r.plan);

    insert into public.scan_jobs (project_id, status, scheduled_for)
    values (r.project_id, 'queued', now());
  end loop;
end;
$$;

revoke execute on function public.enqueue_due_scans() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- claim_next_scan_job() — FOR UPDATE SKIP LOCKED só é possível em plpgsql
-- (PostgREST não expõe locking de linhas), por isso é uma função RPC em vez
-- de um SELECT direto do worker.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.claim_next_scan_job()
returns table (id uuid, project_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
  claimed_project_id uuid;
begin
  select j.id, j.project_id into claimed_id, claimed_project_id
  from public.scan_jobs j
  where j.status = 'queued'
  order by j.scheduled_for
  for update skip locked
  limit 1;

  if claimed_id is null then
    return;
  end if;

  update public.scan_jobs set status = 'running', started_at = now() where scan_jobs.id = claimed_id;

  id := claimed_id;
  project_id := claimed_project_id;
  return next;
end;
$$;

revoke execute on function public.claim_next_scan_job() from public, anon, authenticated;
grant execute on function public.claim_next_scan_job() to service_role;

select cron.schedule('basescope-enqueue-due-scans', '0 * * * *', $$select public.enqueue_due_scans();$$);

select cron.schedule(
  'basescope-process-scan-jobs',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.settings.cron_target_url', true),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  )
  where current_setting('app.settings.cron_target_url', true) is not null
    and current_setting('app.settings.cron_secret', true) is not null;
  $$
);
