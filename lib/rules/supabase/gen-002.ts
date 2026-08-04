import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { normalize, type PgPolicyRow } from "./_shared";

interface IndexColumnRow {
  table_name: string;
  column_name: string;
}

const RULE_ID = "GEN-002";
const DOCS_URL = docsUrlFor(RULE_ID);

/** Só o padrão de posse mais comum — `auth.uid() = coluna` ou o inverso. Não
 * é um parser de SQL genérico; expressões mais complexas não são analisadas. */
function extractOwnershipColumn(expr: string | null): string | null {
  const norm = normalize(expr);
  if (!norm || !norm.includes("auth.uid()")) return null;

  const leftMatch = /auth\.uid\(\)\s*=\s*"?(\w+)"?/.exec(norm);
  if (leftMatch?.[1]) return leftMatch[1];

  const rightMatch = /"?(\w+)"?\s*=\s*auth\.uid\(\)/.exec(norm);
  if (rightMatch?.[1]) return rightMatch[1];

  return null;
}

function remediation(table: string, column: string) {
  return {
    sql: `create index if not exists ${table}_${column}_idx on public.${table} (${column});`,
    steps: [`Cria um índice em public.${table}(${column}) — sem ele, o Postgres faz sequential scan em cada pedido filtrado por esta política.`],
  };
}

export const gen002: Rule = {
  id: RULE_ID,
  title: "Coluna usada em política RLS sem índice",
  severity: "low",
  category: "hygiene",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const policies = await ctx.admin<PgPolicyRow[]>`
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public'
    `;

    const candidates = new Map<string, { table: string; column: string; policy: string }>();
    for (const policy of policies) {
      const column = extractOwnershipColumn(policy.qual) ?? extractOwnershipColumn(policy.with_check);
      if (!column) continue;
      candidates.set(`${policy.tablename}.${column}`, { table: policy.tablename, column, policy: policy.policyname });
    }
    if (candidates.size === 0) return [];

    const indexedColumns = await ctx.admin<IndexColumnRow[]>`
      select t.relname as table_name, a.attname as column_name
      from pg_index i
      join pg_class t on t.oid = i.indrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_attribute a on a.attrelid = t.oid and a.attnum = any(i.indkey)
      where n.nspname = 'public'
    `;
    const indexedSet = new Set(indexedColumns.map((r) => `${r.table_name}.${r.column_name}`));

    const findings: Finding[] = [];
    for (const [key, candidate] of candidates) {
      if (indexedSet.has(key)) continue;

      const remed = remediation(candidate.table, candidate.column);
      findings.push({
        ruleId: RULE_ID,
        severity: "low",
        resourceType: "table",
        resourceName: `public.${candidate.table}`,
        title: "Coluna usada em política RLS sem índice",
        description: `A política "${candidate.policy}" filtra public.${candidate.table} por "${candidate.column}", mas não há índice nessa coluna — cada pedido faz sequential scan.`,
        evidence: { table: candidate.table, column: candidate.column, policy: candidate.policy },
        remediationSql: remed.sql,
        remediationSteps: remed.steps,
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
