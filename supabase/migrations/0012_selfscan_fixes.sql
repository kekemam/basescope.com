-- Mais achados do self-scan (PROJECT_SPEC § 9 — "corre o Basescope contra
-- o próprio Basescope"): RLS-007, notification_settings usava uma única
-- policy FOR ALL. Divide por operação — mesma expressão, só a forma muda.
drop policy "notification_settings_all_own_org" on public.notification_settings;

create policy "notification_settings_select_own_org"
  on public.notification_settings for select to authenticated
  using (project_id in (select id from public.projects where org_id in (select public.get_my_org_ids())));

create policy "notification_settings_insert_own_org"
  on public.notification_settings for insert to authenticated
  with check (project_id in (select id from public.projects where org_id in (select public.get_my_org_ids())));

create policy "notification_settings_update_own_org"
  on public.notification_settings for update to authenticated
  using (project_id in (select id from public.projects where org_id in (select public.get_my_org_ids())))
  with check (project_id in (select id from public.projects where org_id in (select public.get_my_org_ids())));

create policy "notification_settings_delete_own_org"
  on public.notification_settings for delete to authenticated
  using (project_id in (select id from public.projects where org_id in (select public.get_my_org_ids())));
