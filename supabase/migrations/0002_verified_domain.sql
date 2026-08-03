-- Descoberto a construir o wizard de ligação: a verificação de propriedade
-- da secção 0 do PROJECT_SPEC (DNS TXT / ficheiro well-known) prova posse
-- de um DOMÍNIO, não do projeto Supabase em si — é esse domínio que também
-- alimenta CLIENT-001/002 (ScanContext.verifiedDomain). Faltava a coluna.
alter table public.projects add column verified_domain text;

grant select (verified_domain) on public.projects to authenticated;
grant update (verified_domain) on public.projects to authenticated;
