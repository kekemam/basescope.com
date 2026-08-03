-- A política original só exigia um scan_authorizations para o projeto,
-- mas a regra inegociável da secção 0 do PROJECT_SPEC exige TAMBÉM posse
-- verificada (`ownership_verified_at`) antes de qualquer scan — sem isto,
-- um utilizador podia aceitar o agreement e disparar um scan contra
-- credenciais ainda não confirmadas como suas.
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
  );
