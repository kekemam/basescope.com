-- get_advisors (security) sinalizou que get_my_org_ids/is_org_admin/
-- log_finding_status_change ficaram executáveis por `anon` — comportamento
-- por omissão do Postgres (GRANT EXECUTE a PUBLIC em toda função nova), não
-- intenção. Nenhuma delas expõe nada sensível se chamada diretamente (só
-- devolvem dados do próprio auth.uid()), mas reduz-se a superfície mesmo assim.
revoke execute on function public.get_my_org_ids() from public;
grant execute on function public.get_my_org_ids() to authenticated;

revoke execute on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- Função de trigger — nunca precisa de ser chamada via RPC.
revoke execute on function public.log_finding_status_change() from public;
