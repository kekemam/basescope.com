-- `alter database ... set app.settings.*` (usado em 0008 para o cron job
-- ler o URL/segredo do worker) está bloqueado neste tier do Supabase
-- ("permission denied to set parameter") — troca-se por Supabase Vault
-- (extensão supabase_vault, já instalada), que é aliás a forma recomendada
-- atualmente para segredos lidos por pg_cron/pg_net. Os valores em si
-- (URL de produção + segredo partilhado com /api/cron/process-scan-jobs)
-- são inseridos à parte via execute_sql, nunca commitados aqui.
select cron.schedule(
  'basescope-process-scan-jobs',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_target_url'),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'cron_target_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'cron_secret');
  $$
);
