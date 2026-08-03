-- 0004 revogou de `public` (o pseudo-role), mas o Supabase configura
-- `ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO anon,
-- authenticated, service_role` ao nível do schema — cada função nova
-- recebe um GRANT EXPLÍCITO a `anon` na criação, que não passa por
-- `PUBLIC` e por isso o REVOKE de 0004 não o apanhou. Confirmado via
-- information_schema.routine_privileges: `anon` continuava com EXECUTE.
revoke execute on function public.get_my_org_ids() from anon;
revoke execute on function public.is_org_admin(uuid) from anon;
revoke execute on function public.log_finding_status_change() from anon, authenticated;
