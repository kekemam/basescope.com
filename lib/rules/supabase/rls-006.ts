import type { Finding, Rule, ScanContext } from "../types";
import { docsUrlFor } from "../types";
import { normalize, type PgPolicyRow } from "./_shared";

const RULE_ID = "RLS-006";
const DOCS_URL = docsUrlFor(RULE_ID);

/**
 * `request.header.*` é o header HTTP cru — controlado inteiramente pelo
 * chamador, nunca verificado pelo PostgREST. `request.jwt.claims` é
 * diferente (vem de um JWT assinado e validado), por isso não conta aqui;
 * só interessa o caso em que a política confia num header em vez de
 * `auth.uid()`/`auth.jwt()`.
 */
const CLIENT_CONTROLLED_PATTERN = /current_setting\(\s*'request\.header\./i;

function referencesClientControlledValue(expr: string | null): boolean {
  const norm = normalize(expr);
  if (!norm) return false;
  return CLIENT_CONTROLLED_PATTERN.test(norm);
}

function remediation(table: string, policyName: string) {
  return {
    sql: `drop policy if exists "${policyName}" on public.${table};

create policy "${table}_select_own" on public.${table}
  for select to authenticated using (auth.uid() = user_id);`,
    steps: [
      "Substitui a referência a um header HTTP por `auth.uid()` (identidade verificada pelo JWT assinado).",
      "Headers HTTP não são verificados pelo PostgREST — qualquer chamador pode enviar o valor que quiser.",
    ],
  };
}

export const rls006: Rule = {
  id: RULE_ID,
  title: "Política confia num header HTTP em vez de auth.uid()",
  severity: "high",
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
      const flagged = referencesClientControlledValue(policy.qual) || referencesClientControlledValue(policy.with_check);
      if (!flagged) continue;

      const remed = remediation(policy.tablename, policy.policyname);
      findings.push({
        ruleId: RULE_ID,
        severity: "high",
        resourceType: "policy",
        resourceName: `${policy.tablename}.${policy.policyname}`,
        title: "Política confia num header HTTP em vez de auth.uid()",
        description: `A política "${policy.policyname}" em public.${policy.tablename} usa um header HTTP para identificar o utilizador — um chamador pode enviar qualquer valor.`,
        evidence: {
          table: policy.tablename,
          policy: policy.policyname,
          cmd: policy.cmd,
          qual: policy.qual,
          with_check: policy.with_check,
        },
        remediationSql: remed.sql,
        remediationSteps: remed.steps,
        docsUrl: DOCS_URL,
      });
    }

    return findings;
  },
};
