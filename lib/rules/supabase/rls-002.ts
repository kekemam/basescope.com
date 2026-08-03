import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { normalize, OPEN, rolesInclude, type PgPolicyRow } from "./_shared";

const RULE_ID = "RLS-002";
const DOCS_URL = docsUrlFor(RULE_ID);

/**
 * Variantes documentadas em docs/rules-critical.md que um `=== 'true'`
 * simples não apanha. Não é um analisador semântico geral de SQL — são os
 * três padrões explicitamente listados na spec.
 */
function isEffectivelyOpenToAnon(qual: string | null, roles: string[], cmd: string): boolean {
  const norm = normalize(qual);
  if (!norm) return false;
  if (!["SELECT", "ALL"].includes(cmd)) return false;

  if (OPEN.has(norm)) return rolesInclude(roles, "anon");
  if (norm === "(auth.role() = 'anon'::text)" && rolesInclude(roles, "anon")) return true;
  if (norm === "(auth.uid() is not null)" && roles.includes("public")) return true;

  return false;
}

function remediation(table: string, policyName: string) {
  return {
    sql: `drop policy if exists "${policyName}" on public.${table};

create policy "${table}_select_own"
  on public.${table}
  for select
  to authenticated
  using (auth.uid() = user_id);`,
    steps: [
      "Remove a política aberta.",
      "Recria com `to authenticated` e uma condição real (ex.: `auth.uid() = user_id`).",
      "Se a tabela for de facto pública, torna isso explícito: `using (published = true)`, nunca `true` cru.",
    ],
  };
}

export const rls002: Rule = {
  id: RULE_ID,
  title: "Política de leitura totalmente aberta ao anónimo",
  severity: "critical",
  category: "rls",
  async check(ctx: ScanContext): Promise<Finding[]> {
    const policies = await ctx.admin<PgPolicyRow[]>`
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      from pg_policies
      where schemaname = 'public'
      order by tablename, policyname
    `;

    const findings: Finding[] = [];

    for (const policy of policies) {
      if (!isEffectivelyOpenToAnon(policy.qual, policy.roles, policy.cmd)) continue;

      const remed = remediation(policy.tablename, policy.policyname);
      findings.push({
        ruleId: RULE_ID,
        severity: "critical",
        resourceType: "policy",
        resourceName: `${policy.tablename}.${policy.policyname}`,
        title: "Política de leitura totalmente aberta ao anónimo",
        description: `A política "${policy.policyname}" em public.${policy.tablename} permite leitura a qualquer pessoa, sem autenticação.`,
        evidence: {
          table: policy.tablename,
          policy: policy.policyname,
          cmd: policy.cmd,
          roles: policy.roles,
          qual: policy.qual,
        },
        remediationSql: remed.sql,
        remediationSteps: remed.steps,
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
