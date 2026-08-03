import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface SchemaGrantRow {
  nspname: string;
  anon_create: boolean;
  anon_usage: boolean;
  auth_create: boolean;
}

interface TableGrantRow {
  relname: string;
  relrowsecurity: boolean;
  anon_insert: boolean;
  anon_update: boolean;
  anon_delete: boolean;
  anon_truncate: boolean;
}

const RULE_ID = "GRANT-001";
const DOCS_URL = docsUrlFor(RULE_ID);

export const grant001: Rule = {
  id: RULE_ID,
  title: "Privilégios excessivos no schema public",
  severity: "critical",
  category: "grants",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [schemaRow] = await ctx.admin<SchemaGrantRow[]>`
      select nspname,
             has_schema_privilege('anon', nspname, 'CREATE') as anon_create,
             has_schema_privilege('anon', nspname, 'USAGE') as anon_usage,
             has_schema_privilege('authenticated', nspname, 'CREATE') as auth_create
      from pg_namespace
      where nspname = 'public'
    `;

    if (schemaRow?.anon_create) {
      findings.push({
        ruleId: RULE_ID,
        severity: "critical",
        resourceType: "config",
        resourceName: "schema public",
        title: "anon pode criar objetos no schema public",
        description: "Um utilizador anónimo pode criar tabelas, funções ou outros objetos diretamente na tua base de dados.",
        evidence: { anon_create: schemaRow.anon_create },
        remediationSql: "revoke create on schema public from anon, authenticated;",
        remediationSteps: ["Revoga o privilégio CREATE de anon e authenticated no schema public."],
        docsUrl: DOCS_URL,
      });
    }

    const tableRows = await ctx.admin<TableGrantRow[]>`
      select c.relname,
             c.relrowsecurity,
             has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
             has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
             has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
             has_table_privilege('anon', c.oid, 'TRUNCATE') as anon_truncate
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r','p')
        and (has_table_privilege('anon', c.oid, 'INSERT')
          or has_table_privilege('anon', c.oid, 'UPDATE')
          or has_table_privilege('anon', c.oid, 'DELETE')
          or has_table_privilege('anon', c.oid, 'TRUNCATE'))
    `;

    for (const row of tableRows) {
      if (row.anon_truncate) {
        findings.push({
          ruleId: RULE_ID,
          severity: "critical",
          resourceType: "table",
          resourceName: `public.${row.relname}`,
          title: "anon pode truncar a tabela",
          description: `Um utilizador anónimo pode apagar todas as linhas de public.${row.relname} com TRUNCATE.`,
          evidence: { table: row.relname, anon_truncate: true },
          remediationSql: `revoke all on public.${row.relname} from anon;`,
          remediationSteps: ["Revoga todos os privilégios de anon nesta tabela; concede só o estritamente necessário."],
          docsUrl: DOCS_URL,
        });
        continue;
      }

      const hasWriteWithoutRls =
        !row.relrowsecurity && (row.anon_insert || row.anon_update || row.anon_delete);
      if (!hasWriteWithoutRls) continue;

      findings.push({
        ruleId: RULE_ID,
        severity: "critical",
        resourceType: "table",
        resourceName: `public.${row.relname}`,
        title: "anon pode escrever numa tabela sem RLS",
        description: `Um utilizador anónimo pode ${[
          row.anon_insert && "inserir",
          row.anon_update && "atualizar",
          row.anon_delete && "apagar",
        ]
          .filter(Boolean)
          .join(", ")} linhas em public.${row.relname}, que não tem row level security.`,
        evidence: {
          table: row.relname,
          rls_enabled: row.relrowsecurity,
          anon_insert: row.anon_insert,
          anon_update: row.anon_update,
          anon_delete: row.anon_delete,
        },
        remediationSql: `revoke all on public.${row.relname} from anon;

-- Se o anónimo precisa mesmo de escrever (ex.: formulário de contacto):
grant insert on public.${row.relname} to anon;
alter table public.${row.relname} enable row level security;
create policy "anyone_can_submit" on public.${row.relname}
  for insert to anon with check (true);
-- e NENHUMA política de select para anon`,
        remediationSteps: [
          "Revoga privilégios de anon na tabela.",
          "Se a escrita anónima for legítima (ex.: formulário público), ativa RLS e cria só a política de INSERT — nunca de SELECT — para anon.",
        ],
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
