import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { PII_COLUMN_PATTERN } from "./_shared";

interface PiiRow {
  table_name: string;
  relrowsecurity: boolean;
  pii_columns: string[];
}

const RULE_ID = "PII-001";
const DOCS_URL = docsUrlFor(RULE_ID);

const RGPD_NOTE =
  "Esta tabela contém dados pessoais na aceção do RGPD. Se esteve exposta publicamente, " +
  "tens de avaliar a obrigação de notificação à autoridade de controlo no prazo de 72 horas " +
  "(art. 33.º RGPD). Documenta a data em que a falha foi corrigida.";

function remediation(table: string) {
  return {
    sql: `alter table public.${table} enable row level security;

create policy "${table}_select_own"
  on public.${table}
  for select
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.${table} from anon;`,
    steps: ["Ativa RLS e restringe a leitura ao dono da linha (ver ANON-001/RLS-001).", RGPD_NOTE],
  };
}

/**
 * Nota: quando ANON-001 confirma empiricamente `count > 0` numa tabela com
 * PII, essa regra já eleva a sua própria severidade a Critical para o
 * mesmo recurso — os dois findings apontam para o mesmo problema por vias
 * diferentes (estática aqui, empírica lá) e o relatório ordena-os juntos.
 * PII-001 fica deliberadamente independente de ANON-001 para poder correr
 * isolada (fixtures, testes, e o caso em que a sonda HEAD falha mas o
 * catálogo já denuncia a falta de RLS).
 */
export const pii001: Rule = {
  id: RULE_ID,
  title: "Tabela com dados pessoais sem proteção",
  severity: "critical",
  category: "pii",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const rows = await ctx.admin<PiiRow[]>`
      select c.relname as table_name,
             c.relrowsecurity,
             array_agg(a.attname order by a.attnum) as pii_columns
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      where n.nspname = 'public'
        and c.relkind in ('r','p')
        and a.attname ~* ${PII_COLUMN_PATTERN}
      group by c.relname, c.relrowsecurity
    `;

    const findings: Finding[] = [];

    for (const row of rows) {
      if (row.relrowsecurity) continue;

      const remed = remediation(row.table_name);
      findings.push({
        ruleId: RULE_ID,
        severity: "critical",
        resourceType: "table",
        resourceName: `public.${row.table_name}`,
        title: "Tabela com dados pessoais sem proteção",
        description: `public.${row.table_name} contém dados pessoais (${row.pii_columns.join(", ")}) sem row level security ativo.`,
        evidence: {
          table: row.table_name,
          pii_columns: row.pii_columns,
          rls_enabled: row.relrowsecurity,
        },
        remediationSql: remed.sql,
        remediationSteps: remed.steps,
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
