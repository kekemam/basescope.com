-- Fixture "vulnerable" (docs/rules-critical.md § FIXTURES DE TESTE).
-- Dispara as regras que se detetam por inspeção de catálogo Postgres:
-- RLS-001, RLS-002 (via RLS-003 no mesmo policy), RLS-003, PII-001,
-- FN-001, GRANT-001, VIEW-001, STO-001.
--
-- ANON-001, CLIENT-001/002, AUTH-001, EF-001 dependem de contexto fora da
-- BD (sondas HTTP, bundle JS, Management API) e não são cobertas por este
-- fixture — testam-se com HTTP mockado nos próprios ficheiros .test.ts.
--
-- Corre num Postgres limpo (Docker) com estas roles:
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated;

-- ── RLS-001 / PII-001: tabela com PII, RLS desativado ──────────────────
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  phone text
);
grant select, insert, update, delete on public.profiles to anon, authenticated;
-- (RLS deliberadamente NÃO ativado — é o que RLS-001 e PII-001 têm de apanhar)

-- ── RLS-003: WITH CHECK mais permissivo que USING ───────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  total numeric not null
);
alter table public.orders enable row level security;
grant select, insert, update, delete on public.orders to authenticated;

create policy "orders_all" on public.orders
  for all to authenticated
  using (auth.uid() = user_id)
  with check (true);

-- ── FN-001: SECURITY DEFINER sem search_path fixo, EXECUTE para anon ───
create or replace function public.promote_user(target_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.profiles set user_id = target_id where id = target_id;
end;
$$;
grant execute on function public.promote_user(uuid) to anon;

-- ── GRANT-001: privilégios excessivos no schema public ──────────────────
grant create on schema public to anon;

-- ── VIEW-001: vista sem security_invoker sobre tabela protegida ─────────
-- Tabela separada de `profiles` de propósito: aqui queremos RLS ATIVO com
-- política restritiva, para provar que a vista o contorna.
create table public.private_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  note text not null
);
alter table public.private_notes enable row level security;
grant select on public.private_notes to authenticated;
create policy "private_notes_select_own" on public.private_notes
  for select to authenticated using (auth.uid() = user_id);

create view public.user_stats as
  select user_id, count(*) as total from public.private_notes group by user_id;
grant select on public.user_stats to anon;

-- ── STO-001: bucket público com ficheiros sensíveis ──────────────────────
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null
);

insert into storage.buckets (id, name, public) values ('documents', 'documents', true);
insert into storage.objects (bucket_id, name) values
  ('documents', 'contracts/invoice-2026-01.pdf'),
  ('documents', 'kyc/passport-scan.pdf');
