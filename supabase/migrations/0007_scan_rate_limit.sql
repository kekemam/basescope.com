-- Rate limit de scans por plano, aplicado em BD (PROJECT_SPEC § 2:
-- "Rate limit rígido... aplicado em base de dados, não em UI"). Free=1/mês,
-- Solo=cadência semanal (~4/mês), Pro=diária (~31/mês), Agency=diária com
-- teto generoso — os números de "semanal/diária" da secção 8 descrevem
-- cadência de agendamento (Fase 4), aqui viram um teto mensal duro.
create or replace function public.plan_scan_limit(plan text)
returns integer
language sql
immutable
as $$
  select case plan
    when 'free' then 1
    when 'solo' then 4
    when 'pro' then 31
    when 'agency' then 100
    else 1
  end;
$$;

drop policy "scans_insert_own_org_authorized" on public.scans;

create policy "scans_insert_own_org_authorized"
  on public.scans for insert to authenticated
  with check (
    project_id in (
      select id from public.projects
      where org_id in (select public.get_my_org_ids())
        and ownership_verified_at is not null
    )
    and exists (
      select 1 from public.scan_authorizations sa where sa.project_id = scans.project_id
    )
    and (
      select
        o.period_ends_at is null
        or o.period_ends_at < now()
        or o.scans_used_this_period < public.plan_scan_limit(o.plan)
      from public.projects p
      join public.organizations o on o.id = p.org_id
      where p.id = scans.project_id
    )
  );

-- Incrementa (ou reinicia, se o período anterior já expirou) a contagem
-- mensal a cada scan aceite. SECURITY DEFINER porque `authenticated` não
-- tem UPDATE em `organizations.scans_used_this_period`/`period_ends_at`
-- (ver grants em 0001) — só este trigger, correndo como o dono da função,
-- pode tocar nesses campos a partir de uma escrita do browser.
create or replace function public.increment_org_scan_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_org_id uuid;
  current_period_ends_at timestamptz;
begin
  select o.id, o.period_ends_at into target_org_id, current_period_ends_at
  from public.projects p
  join public.organizations o on o.id = p.org_id
  where p.id = new.project_id;

  if current_period_ends_at is null or current_period_ends_at < now() then
    update public.organizations
    set scans_used_this_period = 1,
        period_ends_at = now() + interval '1 month'
    where id = target_org_id;
  else
    update public.organizations
    set scans_used_this_period = scans_used_this_period + 1
    where id = target_org_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.increment_org_scan_count() from public;

create trigger scans_increment_org_count
  after insert on public.scans
  for each row execute function public.increment_org_scan_count();
