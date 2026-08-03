import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { PII_COLUMN_PATTERN, type PiiTableRow } from "./_shared";

interface CandidateTableRow {
  table_name: string;
  rls_enabled: boolean;
  anon_select: boolean;
}

const RULE_ID = "ANON-001";
const DOCS_URL = docsUrlFor(RULE_ID);

function remediationFor(table: string) {
  return {
    sql: `-- 1. Ativar RLS
alter table public.${table} enable row level security;

-- 2. Política mínima: cada utilizador vê apenas as suas linhas
create policy "${table}_select_own"
  on public.${table}
  for select
  to authenticated
  using (auth.uid() = user_id);

-- 3. Confirmar que o anónimo não tem acesso residual
revoke all on public.${table} from anon;`,
    steps: [
      "Ativa RLS na tabela.",
      "Cria uma política de leitura restrita a `auth.uid()`.",
      "Revoga privilégios residuais de `anon`.",
      "Volta a correr a sonda HEAD — `Content-Range` deve passar a `*/0` ou o pedido deve devolver 401.",
    ],
  };
}

export const anon001: Rule = {
  id: RULE_ID,
  title: "Tabela legível por utilizador anónimo",
  severity: "critical",
  category: "anon-access",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const candidates = await ctx.admin<CandidateTableRow[]>`
      select c.relname as table_name,
             c.relrowsecurity as rls_enabled,
             has_table_privilege('anon', c.oid, 'SELECT') as anon_select
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r','p')
      order by c.relname
    `;

    const piiRows = await ctx.admin<PiiTableRow[]>`
      select c.relname as table_name,
             array_agg(a.attname order by a.attnum) as pii_columns
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      where n.nspname = 'public'
        and c.relkind in ('r','p')
        and a.attname ~* ${PII_COLUMN_PATTERN}
      group by c.relname
    `;

    const piiByTable = new Map(piiRows.map((r) => [r.table_name, r.pii_columns]));
    const findings: Finding[] = [];

    const withAnonSelect = candidates.filter((c) => c.anon_select).slice(0, 200);
    const probes = await Promise.all(
      withAnonSelect.map(async (candidate) => {
        const probe = await ctx.anonRest.headCount(candidate.table_name);
        return { candidate, probe };
      }),
    );

    for (const { candidate, probe } of probes) {
      if (probe.status !== 200) continue;
      if (!probe.totalCount || probe.totalCount <= 0) continue;

      const piiColumns = piiByTable.get(candidate.table_name) ?? [];
      const severity = piiColumns.length > 0 ? "critical" : "high";
      const remediation = remediationFor(candidate.table_name);

      findings.push({
        ruleId: RULE_ID,
        severity,
        resourceType: "table",
        resourceName: `public.${candidate.table_name}`,
        title: "Tabela legível por utilizador anónimo",
        description:
          piiColumns.length > 0
            ? `Qualquer pessoa na internet consegue ler ${probe.totalCount} linhas de public.${candidate.table_name}, incluindo dados pessoais.`
            : `Qualquer pessoa na internet consegue ler ${probe.totalCount} linhas de public.${candidate.table_name}.`,
        evidence: {
          table: candidate.table_name,
          anon_visible_rows: probe.totalCount,
          rls_enabled: candidate.rls_enabled,
          pii_columns: piiColumns,
        },
        remediationSql: remediation.sql,
        remediationSteps: remediation.steps,
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
