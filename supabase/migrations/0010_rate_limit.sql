-- Rate limiting por IP/org (PROJECT_SPEC § 9: "Rate limiting por IP e por
-- org em todos os endpoints... ou tabela própria" — tabela própria, mesmo
-- padrão já usado em scan_jobs em vez de introduzir Upstash/Redis).
create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index rate_limit_events_bucket_idx on public.rate_limit_events (bucket_key, created_at);

-- Sem policies: só o admin client (service_role) lê/escreve aqui, nunca o browser.
alter table public.rate_limit_events enable row level security;
alter table public.rate_limit_events force row level security;
