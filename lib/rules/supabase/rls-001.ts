import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";

interface RlsStatusRow {
  table_name: string;
  relrowsecurity: boolean;
  relforcerowsecurity: boolean;
  policy_count: number;
  anon_select: boolean;
  auth_select: boolean;
  size: string;
}

interface RlsInaccessibleRow {
  table_name: string;
  policy_count: number;
}

const RULE_ID = "RLS-001";
const DOCS_URL = docsUrlFor(RULE_ID);

function exposedRemediation(table: string) {
  return {
    sql: `alter table public.${table} enable row level security;
alter table public.${table} force row level security;  -- aplica também ao dono da tabela`,
    steps: [
      "Ativa RLS na tabela.",
      "Ativa FORCE RLS para que se aplique também ao dono.",
      "Adiciona uma política de acesso apropriada (ver ANON-001).",
    ],
  };
}

export const rls001: Rule = {
  id: RULE_ID,
  title: "RLS desativado em tabela do schema public",
  severity: "critical",
  category: "rls",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const exposedRows = await ctx.admin<RlsStatusRow[]>`
      select c.relname as table_name,
             c.relrowsecurity,
             c.relforcerowsecurity,
             (select count(*) from pg_policies p
               where p.schemaname = 'public' and p.tablename = c.relname) as policy_count,
             has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
             has_table_privilege('authenticated', c.oid, 'SELECT') as auth_select,
             pg_size_pretty(pg_total_relation_size(c.oid)) as size
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r','p')
        and c.relrowsecurity = false
    `;

    const findings: Finding[] = [];

    for (const row of exposedRows) {
      if (!row.anon_select && !row.auth_select) continue;

      const remed = exposedRemediation(row.table_name);
      findings.push({
        ruleId: RULE_ID,
        severity: "critical",
        resourceType: "table",
        resourceName: `public.${row.table_name}`,
        title: "RLS desativado em tabela do schema public",
        description: `A tabela public.${row.table_name} não tem row level security ativo e é acessível via API.`,
        evidence: {
          table: row.table_name,
          anon_select: row.anon_select,
          auth_select: row.auth_select,
          policy_count: row.policy_count,
          size: row.size,
        },
        remediationSql: remed.sql,
        remediationSteps: remed.steps,
        docsUrl: DOCS_URL,
      });
    }

    // Caso especial: RLS ativo, zero políticas → tabela inacessível
    // (fail-closed). Não é falha de segurança, é falha funcional — Low.
    const inaccessibleRows = await ctx.admin<RlsInaccessibleRow[]>`
      select c.relname as table_name,
             (select count(*) from pg_policies p
               where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r','p')
        and c.relrowsecurity = true
    `;

    for (const row of inaccessibleRows) {
      if (row.policy_count !== 0) continue;

      findings.push({
        ruleId: RULE_ID,
        severity: "low",
        resourceType: "table",
        resourceName: `public.${row.table_name}`,
        title: "Tabela inacessível: RLS ativo sem políticas",
        description: `public.${row.table_name} tem RLS ativo mas nenhuma política — está inacessível a anon e authenticated.`,
        evidence: { table: row.table_name, policy_count: row.policy_count },
        remediationSql: null,
        remediationSteps: ["Cria pelo menos uma política de SELECT/INSERT/UPDATE/DELETE apropriada."],
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
