-- Idempotência de webhooks Stripe (PROJECT_SPEC § 8: "Tabela stripe_events
-- com event_id UNIQUE"). Só o service_role escreve aqui — o webhook handler
-- corre sempre com a service_role key, nunca com a sessão de um utilizador.
create table public.stripe_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  processed_at timestamptz not null default now()
);

alter table public.stripe_events enable row level security;
alter table public.stripe_events force row level security;

-- Nenhuma policy para anon/authenticated: isto é estado interno de
-- faturação, não superfície de API do produto.

-- Limite de projetos e de scans/mês por plano — usado tanto pela policy de
-- baixo como pelo código de aplicação (ver app/app/projects/new/actions.ts
-- e app/app/p/[id]/actions.ts). Uma função em vez de uma constante em TS
-- porque a policy de INSERT em `projects` também precisa desta regra, e
-- duplicar o mapeamento em dois sítios é como ele diverge sem ninguém notar.
create or replace function public.plan_project_limit(plan text)
returns integer
language sql
immutable
as $$
  select case plan
    when 'free' then 1
    when 'solo' then 3
    when 'pro' then 10
    when 'agency' then 50
    else 1
  end;
$$;

-- Sem isto, um utilizador do plano Free podia ligar projetos sem limite
-- só porque o botão "+ ligar projeto" continuava visível na UI.
drop policy "projects_insert_own_org" on public.projects;

create policy "projects_insert_own_org"
  on public.projects for insert to authenticated
  with check (
    org_id in (select public.get_my_org_ids())
    and (
      select count(*) from public.projects p where p.org_id = projects.org_id
    ) < (
      select public.plan_project_limit(o.plan) from public.organizations o where o.id = projects.org_id
    )
  );
