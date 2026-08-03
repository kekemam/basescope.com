-- Basescope — schema inicial (Fase 1)
-- Convenção: toda a tabela tem RLS + FORCE RLS. Grants são explícitos por coluna
-- onde uma coluna nunca pode chegar ao browser (ex.: encrypted_credentials).
-- Escrita de linhas privilegiadas (criação de org, resultado de scans, findings)
-- passa sempre por código de servidor com a service_role key, nunca por INSERT
-- policy directa a `authenticated` — reduz a superfície de RLS a defender.

-- ─────────────────────────────────────────────────────────────────────────
-- organizations, memberships (tabelas primeiro, sem RLS ainda)
-- ─────────────────────────────────────────────────────────────────────────

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stripe_customer_id text,
  plan text not null default 'free' check (plan in ('free', 'solo', 'pro', 'agency')),
  scans_used_this_period integer not null default 0,
  period_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Helpers — vêm depois de `memberships` de propósito: funções `language
-- sql` (ao contrário de plpgsql) resolvem os objetos referenciados no
-- corpo já na criação, não só na primeira chamada. Criá-las antes da
-- tabela de que dependem falha com "relation does not exist".
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.get_my_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select org_id from public.memberships where user_id = auth.uid();
$$;

create or replace function public.is_org_admin(check_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where org_id = check_org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- RLS de organizations e memberships (agora que as funções já existem)
-- ─────────────────────────────────────────────────────────────────────────

alter table public.organizations enable row level security;
alter table public.organizations force row level security;

create policy "organizations_select_member"
  on public.organizations for select to authenticated
  using (id in (select public.get_my_org_ids()));

create policy "organizations_update_admin"
  on public.organizations for update to authenticated
  using (id in (select public.get_my_org_ids()) and public.is_org_admin(id))
  with check (id in (select public.get_my_org_ids()) and public.is_org_admin(id));

alter table public.memberships enable row level security;
alter table public.memberships force row level security;

create policy "memberships_select_own_org"
  on public.memberships for select to authenticated
  using (org_id in (select public.get_my_org_ids()));

-- Anti-auto-promoção: um admin gere papéis de outros, nunca o próprio.
create policy "memberships_update_admin"
  on public.memberships for update to authenticated
  using (
    org_id in (select public.get_my_org_ids())
    and public.is_org_admin(org_id)
    and user_id <> auth.uid()
  )
  with check (
    org_id in (select public.get_my_org_ids())
    and public.is_org_admin(org_id)
    and user_id <> auth.uid()
  );

create policy "memberships_delete_admin"
  on public.memberships for delete to authenticated
  using (
    org_id in (select public.get_my_org_ids())
    and public.is_org_admin(org_id)
    and user_id <> auth.uid()
  );

-- ─────────────────────────────────────────────────────────────────────────
-- projects
-- ─────────────────────────────────────────────────────────────────────────

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  provider text not null default 'supabase' check (provider in ('supabase', 'firebase')),
  project_ref text not null,
  region text,
  connection_status text not null default 'pending'
    check (connection_status in ('pending', 'connected', 'error', 'revoked')),
  ownership_verified_at timestamptz,
  verification_method text check (verification_method in ('oauth', 'dns', 'file')),
  encrypted_credentials bytea,
  created_at timestamptz not null default now(),
  last_scan_at timestamptz,
  current_score integer check (current_score between 0 and 100)
);

alter table public.projects enable row level security;
alter table public.projects force row level security;

create policy "projects_select_own_org"
  on public.projects for select to authenticated
  using (org_id in (select public.get_my_org_ids()));

create policy "projects_insert_own_org"
  on public.projects for insert to authenticated
  with check (org_id in (select public.get_my_org_ids()));

create policy "projects_update_own_org"
  on public.projects for update to authenticated
  using (org_id in (select public.get_my_org_ids()))
  with check (org_id in (select public.get_my_org_ids()));

create policy "projects_delete_admin"
  on public.projects for delete to authenticated
  using (org_id in (select public.get_my_org_ids()) and public.is_org_admin(org_id));

-- encrypted_credentials nunca é concedida a anon/authenticated, nem em SELECT
-- nem em INSERT/UPDATE — só o service_role (que ignora GRANT/RLS) a escreve,
-- e só dentro do worker de scan. Isto é reforço a nível de coluna, não só de
-- linha: mesmo um bug numa policy nunca devolve o bytea ao browser.
revoke all on public.projects from anon, authenticated;

grant select (
  id, org_id, name, provider, project_ref, region, connection_status,
  ownership_verified_at, verification_method, created_at, last_scan_at, current_score
) on public.projects to authenticated;

grant insert (org_id, name, provider, project_ref, region)
  on public.projects to authenticated;

grant update (name, region)
  on public.projects to authenticated;

grant delete on public.projects to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- scan_authorizations — registo de consentimento, imutável (append-only)
-- ─────────────────────────────────────────────────────────────────────────

create table public.scan_authorizations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agreed_at timestamptz not null default now(),
  ip_address inet not null,
  user_agent text,
  agreement_version text not null
);

alter table public.scan_authorizations enable row level security;
alter table public.scan_authorizations force row level security;

create policy "scan_authorizations_select_own_org"
  on public.scan_authorizations for select to authenticated
  using (project_id in (
    select id from public.projects where org_id in (select public.get_my_org_ids())
  ));

create policy "scan_authorizations_insert_own"
  on public.scan_authorizations for insert to authenticated
  with check (
    user_id = auth.uid()
    and project_id in (
      select id from public.projects where org_id in (select public.get_my_org_ids())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- scans
-- ─────────────────────────────────────────────────────────────────────────

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'done', 'failed', 'partial')),
  started_at timestamptz,
  finished_at timestamptz,
  score integer check (score between 0 and 100),
  findings_count integer not null default 0,
  critical_count integer not null default 0,
  high_count integer not null default 0,
  medium_count integer not null default 0,
  low_count integer not null default 0,
  trigger text not null default 'manual' check (trigger in ('manual', 'scheduled', 'api', 'webhook')),
  error_message text
);

alter table public.scans enable row level security;
alter table public.scans force row level security;

create policy "scans_select_own_org"
  on public.scans for select to authenticated
  using (project_id in (
    select id from public.projects where org_id in (select public.get_my_org_ids())
  ));

-- Regra de ouro da secção 0 do PROJECT_SPEC aplicada em BD: sem um
-- scan_authorizations prévio para o projeto, o INSERT falha.
create policy "scans_insert_own_org_authorized"
  on public.scans for insert to authenticated
  with check (
    project_id in (
      select id from public.projects where org_id in (select public.get_my_org_ids())
    )
    and exists (
      select 1 from public.scan_authorizations sa where sa.project_id = scans.project_id
    )
  );

-- status/score/timestamps só são escritos pelo worker (service_role).

-- ─────────────────────────────────────────────────────────────────────────
-- findings
-- ─────────────────────────────────────────────────────────────────────────

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  rule_id text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  resource_type text not null
    check (resource_type in ('table', 'policy', 'function', 'bucket', 'auth', 'config', 'client', 'edge_function')),
  resource_name text not null,
  title text not null,
  description text not null,
  evidence jsonb not null default '{}'::jsonb,
  remediation_sql text,
  remediation_steps text[] not null default '{}',
  docs_url text,
  status text not null default 'open'
    check (status in ('open', 'fixed', 'ignored', 'false_positive')),
  first_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  ignored_reason text
);

alter table public.findings enable row level security;
alter table public.findings force row level security;

create policy "findings_select_own_org"
  on public.findings for select to authenticated
  using (project_id in (
    select id from public.projects where org_id in (select public.get_my_org_ids())
  ));

-- O utilizador só pode ignorar um achado ou reabri-lo — nunca marcar
-- "fixed" a partir do browser. "fixed" só é escrito pelo worker depois de
-- um re-scan confirmar a correção (botão "Verificar correções").
create policy "findings_update_ignore_own_org"
  on public.findings for update to authenticated
  using (project_id in (
    select id from public.projects where org_id in (select public.get_my_org_ids())
  ))
  with check (
    project_id in (
      select id from public.projects where org_id in (select public.get_my_org_ids())
    )
    and status in ('open', 'ignored')
  );

revoke all on public.findings from anon, authenticated;
grant select on public.findings to authenticated;
grant update (status, ignored_reason) on public.findings to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- finding_history — trilho de auditoria, só leitura para o cliente
-- ─────────────────────────────────────────────────────────────────────────

create table public.finding_history (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings(id) on delete cascade,
  scan_id uuid not null references public.scans(id) on delete cascade,
  status text not null check (status in ('open', 'fixed', 'ignored', 'false_positive')),
  changed_at timestamptz not null default now()
);

alter table public.finding_history enable row level security;
alter table public.finding_history force row level security;

create policy "finding_history_select_own_org"
  on public.finding_history for select to authenticated
  using (finding_id in (
    select f.id from public.findings f
    join public.projects p on p.id = f.project_id
    where p.org_id in (select public.get_my_org_ids())
  ));

create or replace function public.log_finding_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into public.finding_history (finding_id, scan_id, status)
    values (new.id, new.scan_id, new.status);
  end if;
  return new;
end;
$$;

create trigger finding_status_history
  after insert or update of status on public.findings
  for each row execute function public.log_finding_status_change();

-- ─────────────────────────────────────────────────────────────────────────
-- api_keys
-- ─────────────────────────────────────────────────────────────────────────

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  key_hash text not null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.api_keys enable row level security;
alter table public.api_keys force row level security;

create policy "api_keys_select_admin"
  on public.api_keys for select to authenticated
  using (org_id in (select public.get_my_org_ids()) and public.is_org_admin(org_id));

create policy "api_keys_insert_admin"
  on public.api_keys for insert to authenticated
  with check (org_id in (select public.get_my_org_ids()) and public.is_org_admin(org_id));

create policy "api_keys_revoke_admin"
  on public.api_keys for update to authenticated
  using (org_id in (select public.get_my_org_ids()) and public.is_org_admin(org_id))
  with check (org_id in (select public.get_my_org_ids()) and public.is_org_admin(org_id));

revoke all on public.api_keys from anon, authenticated;
grant select (id, org_id, name, last_used_at, revoked_at, created_at) on public.api_keys to authenticated;
grant insert (org_id, name, key_hash) on public.api_keys to authenticated;
grant update (revoked_at) on public.api_keys to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- notification_settings
-- ─────────────────────────────────────────────────────────────────────────

create table public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade unique,
  email_enabled boolean not null default true,
  slack_webhook_url text,
  discord_webhook_url text,
  notify_on text not null default 'high_and_above'
    check (notify_on in ('all', 'high_and_above', 'critical_only'))
);

alter table public.notification_settings enable row level security;
alter table public.notification_settings force row level security;

create policy "notification_settings_all_own_org"
  on public.notification_settings for all to authenticated
  using (project_id in (
    select id from public.projects where org_id in (select public.get_my_org_ids())
  ))
  with check (project_id in (
    select id from public.projects where org_id in (select public.get_my_org_ids())
  ));

-- ─────────────────────────────────────────────────────────────────────────
-- audit_log — só admins da org veem, só o servidor escreve
-- ─────────────────────────────────────────────────────────────────────────

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

create policy "audit_log_select_admin"
  on public.audit_log for select to authenticated
  using (org_id in (select public.get_my_org_ids()) and public.is_org_admin(org_id));

-- Nenhuma policy de insert/update/delete para authenticated: só o
-- service_role escreve no audit_log.
