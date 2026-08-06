-- "Corre o Basescope contra o próprio Basescope e publica o score na
-- landing page" (PROJECT_SPEC § 9/10). Este projeto liga-se a si mesmo
-- através de um papel Postgres dedicado, só-leitura de catálogo
-- (basescope_selfscan, criado à parte via execute_sql — nunca usa a
-- service_role da própria app), e entra na cadência normal de scans
-- agendados (Fase 4) por estar num "org" com plano pro.
alter table public.projects drop constraint projects_verification_method_check;
alter table public.projects add constraint projects_verification_method_check
  check (verification_method = any (array['oauth', 'dns', 'file', 'internal']));
