-- Achado real do self-scan (PROJECT_SPEC § 9, GRANT-001): anon conseguia
-- fazer TRUNCATE nestas 10 tabelas — RLS não protege TRUNCATE (não é
-- linha-a-linha), só GRANT/REVOKE o faz. Nenhuma destas tabelas deve ser
-- tocada por anon (só authenticated via RLS, ou service_role a
-- ultrapassá-la) — revoga tudo, não só truncate.
revoke all on public.organizations from anon;
revoke all on public.memberships from anon;
revoke all on public.scan_authorizations from anon;
revoke all on public.scans from anon;
revoke all on public.finding_history from anon;
revoke all on public.notification_settings from anon;
revoke all on public.audit_log from anon;
revoke all on public.stripe_events from anon;
revoke all on public.rate_limit_events from anon;
revoke all on public.scan_jobs from anon;

-- GEN-002 (self-scan): scan_authorizations.project_id é filtrado por uma
-- policy RLS e não tinha índice.
create index if not exists scan_authorizations_project_id_idx on public.scan_authorizations (project_id);

-- Causa raiz: ALTER DEFAULT PRIVILEGES do papel `postgres` (dono das
-- migrações) concede select/insert/update/delete/truncate a `anon` em
-- TODA tabela nova criada em public — foi assim que scan_jobs (0008) e
-- rate_limit_events (0010) nasceram com este problema sem eu ter pedido.
-- Isto muda o default só para tabelas futuras; não revoga nada já
-- existente (feito manualmente acima e nas migrações anteriores para
-- projects/findings/api_keys).
alter default privileges for role postgres in schema public revoke all on tables from anon;
