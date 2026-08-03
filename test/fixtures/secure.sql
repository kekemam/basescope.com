-- Fixture "secure" — mesmo schema do vulnerable.sql, corrigido.
-- Zero findings esperados nas regras de catálogo. Se este fixture disparar
-- UM findig que seja, é um falso positivo e bloqueia o lançamento
-- (docs/rules-critical.md § FIXTURES DE TESTE).

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
-- Sem GRANT CREATE a anon/authenticated (contraste com GRANT-001 do vulnerable.sql).

-- ── profiles: RLS ativo, política restrita ao dono ──────────────────────
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text not null,
  phone text
);
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (auth.uid() = user_id);

-- ── orders: políticas separadas por operação, sem divergência USING/CHECK ─
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  total numeric not null
);
alter table public.orders enable row level security;
alter table public.orders force row level security;
revoke all on public.orders from anon;
grant select, insert, update, delete on public.orders to authenticated;

create policy "orders_select_own" on public.orders
  for select to authenticated using (auth.uid() = user_id);
create policy "orders_insert_own" on public.orders
  for insert to authenticated with check (auth.uid() = user_id);
create policy "orders_update_own" on public.orders
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "orders_delete_own" on public.orders
  for delete to authenticated using (auth.uid() = user_id);

-- ── promote_user: search_path fixo, sem EXECUTE para anon ───────────────
create or replace function public.promote_user(target_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set user_id = target_id where id = target_id;
end;
$$;
revoke execute on function public.promote_user(uuid) from public, anon;
grant execute on function public.promote_user(uuid) to authenticated;

-- ── private_notes + vista: security_invoker = true ───────────────────────
create table public.private_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  note text not null
);
alter table public.private_notes enable row level security;
alter table public.private_notes force row level security;
revoke all on public.private_notes from anon;
grant select on public.private_notes to authenticated;
create policy "private_notes_select_own" on public.private_notes
  for select to authenticated using (auth.uid() = user_id);

create view public.user_stats
  with (security_invoker = true) as
  select user_id, count(*) as total from public.private_notes group by user_id;
revoke all on public.user_stats from anon;
grant select on public.user_stats to authenticated;

-- ── storage: bucket privado, políticas restritas ao dono da pasta ────────
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf']);
insert into storage.objects (bucket_id, name) values
  ('documents', 'contracts/invoice-2026-01.pdf'),
  ('documents', 'kyc/passport-scan.pdf');
